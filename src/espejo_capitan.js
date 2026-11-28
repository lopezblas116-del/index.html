// ═════════════════════════════════════════════════════════════════════
// EL ESPEJO DEL CAPITÁN (lado jugable) — el puente entre DOS mundos
//
// Hasta hoy existían dos vidas paralelas: tu personaje jugable
// (character.captured, rescate, prisonTick) y tu agente en el mundo vivo
// (sim.user, arrestar, fuga, nemesis). Nada las unía: el sim podía
// arrestar a tu agente y tu partida jamás se enteraba; tu encierro en
// Impel Down no dejaba rastro en el mar. El espejo cierra el círculo:
//
//   sim → juego: arresto/fuga del agente se refleja en character.captured
//                y el arco del némesis genera una ORDEN jugable en la
//                Bitácora ("tu trono te espera").
//   juego → sim: encarcelarUsuario/liberarUsuario (simulacion.js) hacen
//                que el MUNDO vea tu captura y tu fuga.
//
// Una sola ranura (sim.espejo): cada render del juego la repone con el
// personaje vigente — sin duplicar puentes al re-renderizar.
// ═════════════════════════════════════════════════════════════════════
import { addLog } from "./game.js";

export function instalarEspejo(character) {
  const sim = globalThis.JUEGO?.sim;
  if (!sim || !character) return false;
  sim.espejo = (rec, vars) => {
    try {
      const yo = sim.user;
      if (!yo || !vars || !vars.esJugador) return;
      // los vars del sim nombran con nm(): nombre + epíteto — así distingo si
      // YO era el preso (y no el captor que me arrestó)
      const miNombre = sim.nm(yo);
      const presoSoyYo = vars.b === miNombre;
      const fugadoSoyYo = vars.a === miNombre;

      if ((rec.key === "arresto" || rec.key === "arresto_gran") && presoSoyYo) {
        if (character.captured || character.status === "dead") return; // la capa jugable ya lo sabe
        const rescate = Math.max(200, Math.round((Number(character.bounty) || 0) * 0.5));
        character.captured = { island: vars.isla || "Impel Down", ransom: rescate, day: character.world.day, intentos: 0 };
        addLog(character, `⛓️ El espejo: ${character.name} despierta encadenado en ${character.captured.island} — el mundo entero ya lo sabe. Rescate: ฿${rescate}.`);
        document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: "Tu capitán está preso: el mundo lo ve y la deuda viene en camino." } }));
      } else if (rec.key === "fuga" && fugadoSoyYo && character.captured && (!vars.isla || vars.isla === character.captured.island)) {
        delete character.captured; // la cadena se rompe en ambos lados
        addLog(character, `🌀 El espejo: la fuga de ${vars.isla || "tu celda"} se confirma en el mar. Nadie vuelve de prisión igual.`);
      } else if (rec.key === "nemesis" && fugadoSoyYo) {
        // LA ORDEN JUGABLE: tu bandera renació — la Bitácora te da el rumbo
        character.world.news.unshift({ type: "nemesis-orden", text: `👑 ${vars.a} izó «${vars.crew}» y reclama ${vars.isla}: tu trono te espera.`, location: vars.isla, day: character.world.day });
        character.world.news = character.world.news.slice(0, 60);
        addLog(character, `👑 Orden de reclamo: tu bandera renació en ${vars.isla} con «${vars.crew}». Navega y reivindica tu trono — la Bitácora te da el rumbo.`);
        document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: "Orden de reclamo en la Bitácora: tu trono te espera." } }));
      }
    } catch { /* un espejo roto no tumba la partida */ }
  };
  return true;
}
