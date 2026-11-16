import { SUPABASE_CONFIG } from "./network-config.js";
import { advanceLocalWorld, applyLocalAction, createLocalWorld } from "./geopolitics.js";
import { advanceFruitCycle, claimLocalFruit, createLocalFruitLedger, releaseLocalFruit } from "./devil_fruits.js";
import { browserStorage, readStorage, writeStorage } from "./storage_adapter.js";

const TABLES = ["islands_control", "global_events", "bounties_leaderboard", "fallen_captains", "bosses", "devil_fruits"];

export function createNetwork({ config = SUPABASE_CONFIG, fetcher = globalThis.fetch, storage } = {}) {
  if (storage === undefined) {
    storage = browserStorage();
  }
  const scope = encodeURIComponent(config.url || "local");
  const sessionKey = `one-latam-supabase-session:${scope}`;
  const queueKey = `one-latam-world-outbox:${scope}`;
  const worldKey = "one-latam-local-world";
  let world = createLocalWorld();
  world.devil_fruits ??= createLocalFruitLedger();
  let status = "local";
  let error = "";
  let session = null;
  let pending = [];
  let working = Promise.resolve();
  let batchDepth = 0;
  let syncNeeded = false;
  let notificationNeeded = false;
  const listeners = new Set();
  const configured = Boolean(config.url && config.publishableKey);
  const configError = Boolean(config.url) !== Boolean(config.publishableKey);
  if (!configured && !configError && storage) {
    try {
      const saved = readStorage(worldKey, storage);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed.islands_control) || !Array.isArray(parsed.global_events) || !Array.isArray(parsed.bounties_leaderboard) || !Array.isArray(parsed.fallen_captains) || !Array.isArray(parsed.bosses)) throw new Error("Mundo local inválido.");
        for (const island of parsed.islands_control) {
          island.tax_rate = Math.max(0, Math.min(20, Number(island.tax_rate) || 0));
          island.taxes = Math.max(0, Number(island.taxes) || 0);
          island.treasury = Math.max(0, Number(island.treasury) || 0);
          island.blockade_until_day = Math.max(0, Number(island.blockade_until_day) || 0);
          island.besieged_by ??= null;
        }
        parsed.devil_fruits ??= createLocalFruitLedger();
        world = parsed;
      }
    } catch { status = "offline"; error = "No se pudo leer el mundo local guardado."; }
  }
  function saveLocalWorld() {
    if (configured || configError || !storage) return false;
    if (!writeStorage(worldKey, JSON.stringify(world), storage)) { status = "offline"; error = "No se pudo guardar el mundo local."; return false; }
    return true;
  }
  if (configured && storage) {
    try {
      const saved = readStorage(queueKey, storage);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) throw new Error("Cola de eventos inválida.");
        pending = parsed;
      }
    } catch { status = "offline"; error = "No se pudo leer la cola local de eventos."; }
  }
  function saveQueue() {
    try {
      if (!storage) throw new Error("Almacenamiento no disponible.");
      return writeStorage(queueKey, JSON.stringify(pending), storage);
    } catch { return false; }
  }
  const notify = () => {
    if (batchDepth) { notificationNeeded = true; return; }
    listeners.forEach((listener) => listener({ status, error, world, pending: pending.length }));
  };
  const setStatus = (next, message = "") => { status = next; error = message; notify(); };
  const endpoint = () => {
    const url = new URL(config.url);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("La URL de Supabase debe usar HTTPS.");
    return url.origin;
  };
  async function request(path, options = {}, token) {
    const response = await fetcher(`${endpoint()}${path}`, {
      ...options,
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${token || config.publishableKey}`, "Content-Type": "application/json", ...options.headers },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Servicio compartido: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  async function authenticate() {
    if (session?.expires_at > Date.now() / 1000 + 60) return;
    if (!session) {
      try { session = JSON.parse(readStorage(sessionKey, storage) || "null"); }
      catch { session = null; }
    }
    if (session?.expires_at > Date.now() / 1000 + 60) return;
    const refresh = session?.refresh_token;
    session = await request(refresh ? "/auth/v1/token?grant_type=refresh_token" : "/auth/v1/signup", {
      method: "POST", body: JSON.stringify(refresh ? { refresh_token: refresh } : { data: {} })
    });
    if (!session?.access_token || !session?.refresh_token || !session?.user?.id) throw new Error("Supabase no devolvió una sesión anónima válida.");
    session.expires_at ??= Math.floor(Date.now() / 1000) + session.expires_in;
    try {
      if (!storage) throw new Error("Almacenamiento no disponible.");
      if (!writeStorage(sessionKey, JSON.stringify(session), storage)) throw new Error("Almacenamiento no disponible.");
    }
    catch { throw new Error("No se pudo guardar la sesión compartida en el navegador."); }
  }
  async function sync() {
    if (!configured) { if (configError) setStatus("offline", "Configuración incompleta: se necesitan URL y clave pública."); else notify(); return; }
    try {
      setStatus("connecting");
      await authenticate();
      while (pending.length) {
        const action = pending[0];
        await request("/rest/v1/rpc/apply_world_action", { method: "POST", body: JSON.stringify({ action }) }, session.access_token);
        pending.shift();
        if (!saveQueue()) throw new Error("No se pudo guardar la cola de eventos.");
      }
      const results = await Promise.all(TABLES.map((table) => {
        const order = table === "global_events" || table === "fallen_captains" ? "&order=created_at.desc" : table === "bounties_leaderboard" ? "&order=bounty.desc" : "";
        const fields = table === "devil_fruits" ? "id,name,type,technique,bonus,x,y,state" : "*";
        return request(`/rest/v1/${table}?select=${fields}&limit=100${order}`, {}, session.access_token);
      }));
      world = Object.fromEntries(TABLES.map((table, i) => [table, results[i]]));
      setStatus("online");
    } catch (reason) {
      setStatus("offline", reason instanceof Error ? reason.message : "No se pudo sincronizar el mundo.");
    }
  }
  function scheduleSync() {
    working = working.then(sync);
    return working;
  }
  function publish(type, data, actor, eventId) {
    const action = { event_id: eventId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, type, data, actor: { id: actor.id, name: actor.name } };
    applyLocalAction(world, action, action.actor);
    saveLocalWorld();
    if (configured) {
      pending.push(action);
      if (batchDepth) syncNeeded = true;
      else {
        if (!saveQueue()) { status = "offline"; error = "No se pudo guardar la cola; los eventos solo permanecen en esta sesión."; }
        scheduleSync();
      }
    }
    notify();
    return { status: configured ? "pending" : "local" };
  }
  return {
    subscribe(listener) { listeners.add(listener); listener({ status, error, world, pending: pending.length }); return () => listeners.delete(listener); },
    sync: scheduleSync, publish, snapshot: () => ({ status, error, world, pending: pending.length }),
    batch(callback) {
      batchDepth += 1;
      try { return callback(); }
      finally {
        batchDepth -= 1;
        if (!batchDepth) {
          if (syncNeeded) {
            syncNeeded = false;
            if (!saveQueue()) { status = "offline"; error = "No se pudo guardar la cola; los eventos solo permanecen en esta sesión."; }
            scheduleSync();
          }
          if (notificationNeeded) { notificationNeeded = false; notify(); }
        }
      }
    },
    advanceCycle(day) {
      if (configured || configError) return;
      if (world.last_cycle_day == null) world.last_cycle_day = Math.max(0, day - 1);
      const changed = advanceLocalWorld(world, day);
      const reborn = advanceFruitCycle(world.devil_fruits, day);
      if (reborn) {
        world.global_events.unshift({ event_id: `fruit-rebirth-${day}`, type: "fruit", text: "🌊 Una Akuma no Mi reencarnó en algún punto remoto del mar.", created_at: new Date().toISOString() });
      }
      if (changed || reborn) { saveLocalWorld(); notify(); }
    },
    persistLocalWorld() {
      if (configured || configError) return false;
      const saved = saveLocalWorld();
      notify();
      return saved;
    },
    mutateLocalWorld(callback) {
      if (configured || configError || typeof callback !== "function") return null;
      const previous = world;
      const candidate = JSON.parse(JSON.stringify(world));
      const result = callback(candidate);
      world = candidate;
      if (!saveLocalWorld()) {
        world = previous;
        notify();
        return { ok: false, message: error || "No se pudo guardar el mundo local." };
      }
      notify();
      return result;
    },
    async claimFruit(id, captainId, point) {
      if (configured) {
        try {
          await scheduleSync();
          await authenticate();
          const fruit = await request("/rest/v1/rpc/claim_devil_fruit", { method: "POST", body: JSON.stringify({ p_fruit_id: id, p_captain_id: captainId, p_x: point.x, p_y: point.y }) }, session.access_token);
          if (fruit) {
            const entry = world.devil_fruits?.find((item) => item.id === id);
            if (entry) { entry.state = "owned"; entry.owner_id = captainId; entry.captain_id = captainId; notify(); }
          }
          return fruit;
        } catch (reason) { setStatus("offline", reason instanceof Error ? reason.message : "No se pudo reclamar la fruta."); return null; }
      }
      if (configError) return null;
      const fruit = claimLocalFruit(world.devil_fruits, id, captainId, point);
      if (fruit) { saveLocalWorld(); notify(); }
      return fruit;
    },
    async releaseFruit(id, captainId) {
      if (configured) {
        try {
          await scheduleSync();
          await authenticate();
          const released = await request("/rest/v1/rpc/release_devil_fruit", { method: "POST", body: JSON.stringify({ p_fruit_id: id, p_captain_id: captainId }) }, session.access_token);
          if (released) {
            const entry = world.devil_fruits?.find((item) => item.id === id);
            if (entry) entry.state = "reincarnating";
            notify();
          }
          return Boolean(released);
        } catch (reason) { setStatus("offline", reason instanceof Error ? reason.message : "No se pudo liberar la fruta."); return false; }
      }
      if (configError) return false;
      const released = releaseLocalFruit(world.devil_fruits, id, captainId, world.last_cycle_day || 0);
      if (released) { saveLocalWorld(); notify(); }
      return released;
    },
    async scout(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (!configured && !configError) return world.bosses.find((boss) => boss.status === "fugitive" && boss.secret_location && Math.hypot(x - boss.secret_location.x, y - boss.secret_location.y) <= 80)?.name ?? null;
      if (status !== "online") return null;
      try {
        await authenticate();
        return await request("/rest/v1/rpc/scout_fugitive", { method: "POST", body: JSON.stringify({ p_x: x, p_y: y }) }, session.access_token);
      } catch (reason) {
        setStatus("offline", reason instanceof Error ? reason.message : "No se pudo investigar la zona.");
        return null;
      }
    }
  };
}
