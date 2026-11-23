// ── El Gobierno Mundial y sus sombras ──
// Gorosei, Tenryuubito, CP9, los Filósofos del Vacío y El Arquitecto.
// Todo determinista por día e isla: el mundo no improvisa, conspira.

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const hash = (value) => [...String(value)].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);

// ── los Cinco Ancianos: el mundo se gobierna con decretos, no con justificación ──
const DECRETOS = [
  { id: "tributo", texto: "Los Cinco Ancianos alzan el tributo celestial: los puertos del Gobierno cobran lo que los nobles pidan.", efecto: { tributo: 1.5 } },
  { id: "caceria", texto: "Decreto de cacería: toda recompensa sobre ฿20.000 se cobra al doble. Los cazadores salen al mar.", efecto: { caceria: 2 } },
  { id: "silencio", texto: "El Gobierno silencia la prensa del mar: menos noticias salen de los puertos esta semana.", efecto: { silencio: true } },
  { id: "cp9", texto: "Orden secreta a Cipher Pol: vigilar a todo capitán cuya sombra moleste en Mariejois.", efecto: { cp9Agresivo: true } },
  { id: "tregua", texto: "Los Ancianos declaran la tregua de la cosecha: los puertos abren sus mercados sin impuestos de guerra.", efecto: { tributo: 0.5 } }
];

export function decretoDelDia(day = 1) {
  return DECRETOS[hash(`decreto:${day}`) % DECRETOS.length];
}

// ── los Nobles Mundiales: descendientes de los fundadores, dueños del aire que respiran ──
const TENRYUUBITO = [
  "San Elbaf el Terrible", "Donna Celestina", "Baldo el Codicioso", "Rosa Marijois", "Kumadori el Vago"
];

export function desfileTenryuubito(character, random = Math.random) {
  if (character.status === "dead" || character.location?.atSea) return null;
  const control = String(character.location?.control || "Marina");
  if (!/marina|gobierno/i.test(control)) return null; // el noble solo pasea donde su bandera manda
  const dia = Number(character.world?.day) || 1;
  const isla = character.location?.island || "—";
  if (hash(`desfile:${isla}:${Math.floor(dia / 3)}`) % 5 !== 0) return null; // cada tres días, una isla de cinco
  const noble = TENRYUUBITO[hash(`noble:${isla}:${dia}`) % TENRYUUBITO.length];
  const tributo = Math.max(60, Math.round((Number(character.bounty) || 0) * 0.12) + 60);
  return { noble, tributo, dia };
}

export function pagarTributo(character, desfile) {
  if (!desfile) return { ok: false, message: "No hay desfile que aplacar." };
  if ((Number(character.berries) || 0) < desfile.tributo) {
    return { ok: false, message: `No tienes ฿${desfile.tributo} para el tributo de ${desfile.noble}. Mirará hacia otro lado… o no.` };
  }
  character.berries -= desfile.tributo;
  character.log.unshift({ time: new Date().toISOString(), message: `👑 Pagaste el tributo celestial a ${desfile.noble} (฿${desfile.tributo}). La gente desvía la mirada: mejor así.` });
  return { ok: true, message: `Tributo pagado. ${desfile.noble} sigue su camino.` };
}

export function desoibirTributo(character, desfile, random = Math.random) {
  if (!desfile) return { ok: false, message: "No hay desfile que desoír." };
  const sube = Math.max(3000, Math.round(desfile.tributo * 12));
  character.bounty = (Number(character.bounty) || 0) + sube;
  character.log.unshift({ time: new Date().toISOString(), message: `👑 Ignoraste el tributo de ${desfile.noble}. Un héroe para los pobres; una mancha para el Gobierno (+฿${sube} de recompensa).` });
  return { ok: true, message: `Desafiar a un noble te puso precio: +฿${sube}.` };
}

// ── Cipher Pol 9: el Gobierno no espía, "escucha" ──
const AGENTES_CP9 = [
  { nombre: "Rob Lucci", apodo: "el Colombino", fuerza: 1.6 },
  { nombre: "Kaku", apodo: "el Carpiniero", fuerza: 1.2 },
  { nombre: "Kalifa", apodo: "la Jabonosa", fuerza: 1.1 },
  { nombre: "Blueno", apodo: "la Puerta", fuerza: 1.0 }
];

export function vigilanciaCP9(character) {
  if (character.status === "dead" || character.cp9?.derrotadoPor === character.location?.island) return null;
  const bounty = Number(character.bounty) || 0;
  const agresivo = decretoDelDia(Number(character.world?.day) || 1).efecto.cp9Agresivo;
  const umbral = agresivo ? 15000 : 30000;
  if (bounty < umbral) return null;
  const isla = character.location?.island || "—";
  const control = String(character.location?.control || "Marina");
  if (!/marina|gobierno/i.test(control) && !agresivo) return null;
  if (character.cp9?.vigilando && character.cp9.isla === isla) return character.cp9; // ya está marcado
  const agente = AGENTES_CP9[hash(`cp9:${isla}:${bounty}`) % AGENTES_CP9.length];
  const estado = { vigilando: true, isla, agente: agente.nombre, apodo: agente.apodo, fuerza: agente.fuerza, desde: Number(character.world?.day) || 1 };
  character.cp9 = estado;
  character.log.unshift({ time: new Date().toISOString(), message: `👁 CP9 te tiene en la lista: ${agente.nombre}, "${agente.apodo}", te observa desde ${isla}. No es paranoia si te siguen de verdad.` });
  return estado;
}

// la emboscada: el agente actúa cuando el capitán intenta zarpar o tras dos días de espera
export function emboscadaCP9(character, random = Math.random) {
  const vigilancia = character.cp9;
  if (!vigilancia?.vigilando || character.status === "dead") return null;
  const atributo = (Number(character.stats?.strength) || 0) + (Number(character.stats?.agility) || 0) / 2 + (Number(character.level) || 1) * 1.2;
  const poderAgente = 22 * (vigilancia.fuerza || 1);
  const gana = random() < clamp(0.34 + atributo / 90, 0.15, 0.82);
  if (gana) {
    const recompensa = Math.round(4000 * (vigilancia.fuerza || 1));
    character.berries = (Number(character.berries) || 0) + recompensa;
    character.bounty = (Number(character.bounty) || 0) + Math.round(recompensa / 3);
    character.experience = (Number(character.experience) || 0) + 45;
    character.avatarActivity = "victory";
    character.log.unshift({ time: new Date().toISOString(), message: `🥋 EMBOSCADA CP9: ${vigilancia.agente} cayó tras un combate limpio de Rokushiki. Se fue con respeto y con tus ฿${recompensa} de premio. El Gobierno no olvida.` });
    character.cp9 = { vigilando: false, derrotadoPor: character.location?.island, agente: vigilancia.agente };
    return { ok: true, message: `Derrotaste a ${vigilancia.agente}: +฿${recompensa}.` };
  }
  const danio = Math.round(18 * (vigilancia.fuerza || 1));
  character.stats.health = Math.max(1, character.stats.health - danio);
  character.log.unshift({ time: new Date().toISOString(), message: `🥋 ${vigilancia.agente} te sorprendió con Shigan de noche (-${danio} HP) y se esfumó. La próxima vez tú lo esperas.` });
  return { ok: false, message: `${vigilancia.agente} te golpeó y desapareció (-${danio} HP).` };
}

// ── los Filósofos del Vacío: leen lo que el Gobierno quemó ──
const FILOSOFOS = ["Umbra del Faro", "Sama el Asno Sabio", "Doctora Ohara Menor", "El Vecino de Kambel", "Profesora Risu"];
const TEORIAS = [
  "Hay un siglo que no existe en ningún libro: lo borran antes de que se escriba.",
  "Las ciudades-puente no unen islas: las vigila. Cada muelle es un dedo del Gobierno.",
  "Los Tenryuubito no gobiernan: custodian algo. Nadie pregunta qué.",
  "El Arquitecto no construyó puentes: dibujó la línea del mundo que vendría después.",
  "Los poneglyphs no son historias: son advertencias escritas por alguien que sabía el final.",
  "El Vacío no fue derrotado: se mudó. Ahora firma los decretos de los Ancianos."
];

export function filosofoDeIsla(character) {
  const isla = character.location?.island || "—";
  const dia = Number(character.world?.day) || 1;
  const seed = hash(`filosofo:${isla}`);
  return { nombre: FILOSOFOS[seed % FILOSOFOS.length], teoria: TEORIAS[(seed + Math.floor(dia / 4)) % TEORIAS.length], precio: 30 };
}

export function consultarFilosofo(character, random = Math.random) {
  if (character.status === "dead" || character.location?.atSea) return { ok: false, message: "El filósofo no conversa con el mar abierto." };
  const filosofo = filosofoDeIsla(character);
  if ((Number(character.berries) || 0) < filosofo.precio) return { ok: false, message: `El precio de la verdad es ฿${filosofo.precio}. ${filosofo.nombre} no regala su tiempo.` };
  character.berries -= filosofo.precio;
  const fragmento = dejarFragmento(character, random);
  character.log.unshift({ time: new Date().toISOString(), message: `📚 ${filosofo.nombre} habla bajo la linterna: «${filosofo.teoria}»${fragmento ? ` Te deja un papel doblado: ${fragmento.nombre}.` : ""}` });
  character.experience = (Number(character.experience) || 0) + 8;
  return { ok: true, message: `${filosofo.nombre}: «${filosofo.teoria}»${fragmento ? ` (+${fragmento.nombre})` : ""}` };
}

// ── El Arquitecto: la conspiración que se dibuja, no se cuenta ──
const FRAGMENTOS = [
  { id: "puente", nombre: "Plano I · La Ciudad-Puente", texto: "Un puente que une los cuatro mares por donde el Gobierno marcharía sin mar abierto." },
  { id: "estrellas", nombre: "Plano II · El Camino de las Estrellas", texto: "Rutas dibujadas que evitan la Franja de Calma: alguien aprendió a cruzarla sin Log Pose." },
  { id: "raices", nombre: "Plano III · Las Raíces de Mariejois", texto: "El mundo bajo la tierra sagrada: sótanos, cadenas y un sello con el signo del Vacío." },
  { id: "marea", nombre: "Plano IV · La Manda de la Marea", texto: "Canales que redirigirían el mar entero: el mapa puede reescribirse si se domina el agua." },
  { id: "silencio", nombre: "Plano V · El Sello del Silencio", texto: "Cómo se borra un siglo: la máquina que convierte libros en ceniza y palabras en leyenda." },
  { id: "regreso", nombre: "Plano VI · El Regreso del Rey", texto: "Y al final de todos los planos, una sala vacía esperando un nombre que aún no ha llegado." }
];

export const FRAGMENTOS_ARQUITECTO = FRAGMENTOS.length;

export function dejarFragmento(character, random = Math.random) {
  if (!character.arquitecto) character.arquitecto = { fragmentos: [], revelado: false };
  const tenidos = new Set(character.arquitecto.fragmentos);
  const pendientes = FRAGMENTOS.filter((f) => !tenidos.has(f.id));
  if (!pendientes.length || random() >= 0.45) return null;
  const fragmento = pendientes[hash(`frag:${character.location?.island}:${pendientes.length}`) % pendientes.length];
  character.arquitecto.fragmentos.push(fragmento.id);
  character.codex?.discoveries?.push?.(`gobierno:arquitecto`);
  return fragmento;
}

export function arquitectoCompleto(character) {
  return character.arquitecto?.revelado || (character.arquitecto?.fragmentos?.length || 0) >= FRAGMENTOS.length;
}

export function revelarArquitecto(character) {
  if (character.arquitecto?.revelado || !arquitectoCompleto(character)) return null;
  character.arquitecto.revelado = true;
  character.experience = (Number(character.experience) || 0) + 120;
  character.log.unshift({ time: new Date().toISOString(), message: "🏛 LOS SEIS PLANOS: sobre la mesa, el Arquitecto cuenta la verdad. No hay conspiración por el poder: la hay por el MAPA. El Gobierno no teme a los piratas — teme que el mundo se vuelva a dibujar." });
  return { message: "La conspiración del Arquitecto se reveló: el Gobierno no teme piratas, teme mapas nuevos." };
}

// ── el pulso del Gobierno: una pasada por latido, decidida por el calendario ──
export function governmentPulse(character, random = Math.random) {
  if (!character || character.status === "dead" || character.location?.atSea) return;
  if (!character.gobierno) character.gobierno = { ultimoDia: 0 };
  const dia = Number(character.world?.day) || 1;
  if (dia === character.gobierno.ultimoDia) return; // el Gobierno decide una vez por día
  character.gobierno.ultimoDia = dia;
  const decreto = decretoDelDia(dia);
  if (hash(`anuncio:${dia}`) % 2 === 0) {
    character.log.unshift({ time: new Date().toISOString(), message: `📰 GOROSEI · ${decreto.texto}` });
  }
  const desfile = desfileTenryuubito(character, random);
  if (desfile) {
    character.desfilePendiente = desfile;
    character.log.unshift({ time: new Date().toISOString(), message: `👑 DESFILE CELESTIAL: ${desfile.noble} cruza ${desfile.isla} bajo burbuja. Exige ฿${desfile.tributo} de tributo a cada capitán presente.` });
  }
  vigilanciaCP9(character);
  // la emboscada llega si la vigilancia lleva dos días encima
  if (character.cp9?.vigilando && dia - character.cp9.desde >= 2 && random() < 0.5) emboscadaCP9(character, random);
  // el Arquitecto golpea cuando todos los planos están sobre la mesa
  if (arquitectoCompleto(character)) revelarArquitecto(character);
}

// la vista de los planos: qué se tiene y qué falta de la conspiración
export function planosDeArquitecto(character) {
  const tenidos = new Set(character?.arquitecto?.fragmentos || []);
  return FRAGMENTOS.map((f) => ({ ...f, tenido: tenidos.has(f.id) }));
}

// ── titulares para el Diario del Mar ──
export function noticiasGobierno(character, day = 1) {
  const decreto = decretoDelDia(day);
  const titulares = [
    { fuente: "Mariejois", texto: decreto.texto },
    { fuente: "Enies Lobby", texto: "La Puerta de la Justicia recibe a otra cosecha de tributos. Nadie pregunta adónde va." },
    { fuente: "Water 7", texto: "Los carpinteros hablan de planos antiguos que nadie ha visto: dicen que el Arquitecto vuelve." },
    { fuente: "CP9", texto: "Un agente fue visto comprando periódicos. Los compradores de periódicos son personas que buscan a alguien." }
  ];
  const seed = hash(`noticias:${day}`);
  return [titulares[seed % titulares.length], titulares[(seed >>> 3) % titulares.length]].filter((v, i, arr) => arr.findIndex((x) => x.fuente === v.fuente) === i);
}

// el Gobierno en una sola línea para el HUD
export function resumenGobierno(character) {
  const decreto = decretoDelDia(Number(character?.world?.day) || 1);
  const bits = [`Decreto: ${decreto.id}`];
  if (character?.cp9?.vigilando) bits.push(`👁 CP9: ${character.cp9.agente} te vigila`);
  if (character?.desfilePendiente) bits.push(`👑 ${character.desfilePendiente.noble} exige tributo`);
  const planos = character?.arquitecto?.fragmentos?.length || 0;
  if (planos) bits.push(`📐 Planos del Arquitecto: ${planos}/${FRAGMENTOS.length}`);
  return bits.join(" · ");
}
