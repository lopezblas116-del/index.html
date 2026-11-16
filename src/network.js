import { SUPABASE_CONFIG } from "./network-config.js";
import { advanceLocalWorld, applyLocalAction, createLocalWorld } from "./geopolitics.js";

const TABLES = ["islands_control", "global_events", "bounties_leaderboard", "fallen_captains", "bosses"];

export function createNetwork({ config = SUPABASE_CONFIG, fetcher = globalThis.fetch, storage } = {}) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; }
    catch { storage = null; }
  }
  const scope = encodeURIComponent(config.url || "local");
  const sessionKey = `one-latam-supabase-session:${scope}`;
  const queueKey = `one-latam-world-outbox:${scope}`;
  const worldKey = "one-latam-local-world";
  let world = createLocalWorld();
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
      const saved = storage.getItem(worldKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed.islands_control) || !Array.isArray(parsed.global_events) || !Array.isArray(parsed.bounties_leaderboard) || !Array.isArray(parsed.fallen_captains) || !Array.isArray(parsed.bosses)) throw new Error("Mundo local inválido.");
        world = parsed;
      }
    } catch { status = "offline"; error = "No se pudo leer el mundo local guardado."; }
  }
  function saveLocalWorld() {
    if (configured || configError || !storage) return;
    try { storage.setItem(worldKey, JSON.stringify(world)); }
    catch { status = "offline"; error = "No se pudo guardar el mundo local."; }
  }
  if (configured && storage) {
    try {
      const saved = storage.getItem(queueKey);
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
      storage.setItem(queueKey, JSON.stringify(pending));
      return true;
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
      try { session = JSON.parse(storage?.getItem(sessionKey) || "null"); }
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
      storage.setItem(sessionKey, JSON.stringify(session));
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
        return request(`/rest/v1/${table}?select=*&limit=100${order}`, {}, session.access_token);
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
  function publish(type, data, actor) {
    const action = { event_id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, type, data, actor: { id: actor.id, name: actor.name } };
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
      if (advanceLocalWorld(world, day)) { saveLocalWorld(); notify(); }
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
