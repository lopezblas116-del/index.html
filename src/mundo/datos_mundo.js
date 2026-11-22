import { getMapIslands } from '../map.js';

// Datos del mundo: geografía (del lorebook del usuario), facciones, carácter y catálogos.
(function (G) {
  const D = (G.D = G.D || {});

  // ── Geografía (mapa 2600×1400: océano respirable, islas espaciadas) ──
  D.W = 2600; D.H = 1400;
  D.RL_X = 1300;                 // Muralla Roja (vertical, continente ancho)
  D.GL_Y0 = 550; D.GL_Y1 = 900; // Gran Ruta (franja central amplia)
  D.CB_T = 490; D.CB_B = 960;   // Franjas de Calma

  D.REGIONS = {
    NB: { name: 'North Blue', x0: 40, x1: 1260, y0: 20, y1: 470 },
    WB: { name: 'West Blue', x0: 40, x1: 1260, y0: 980, y1: 1380 },
    EB: { name: 'East Blue', x0: 1340, x1: 2560, y0: 20, y1: 470 },
    SB: { name: 'South Blue', x0: 1340, x1: 2560, y0: 980, y1: 1380 },
    PAR: { name: 'Paraíso (1.ª mitad de la Gran Ruta)', x0: 1340, x1: 2560, y0: 565, y1: 885 },
    NW: { name: 'Nuevo Mundo (2.ª mitad)', x0: 40, x1: 1260, y0: 565, y1: 885 }
  };

  // Isla: id, nombre, región, pos, radio, tema, flags: base (Marina), tribunal, cuartel,
  // noNav (Franja de Calma: no se puede navegar), oculta (solo con pistas), especial (rutas especiales).
  const I = (id, n, reg, x, y, r, tema, f) => Object.assign({ id, n, reg, x, y, r, tema }, f || {});
  D.ISLAS = [
    // East Blue (donde empieza casi todo)
    I('foosha', 'Villa Foosha', 'EB', 1405, 115, 26, 'verde', { natal: 1 }),
    I('shells', 'Shells Town', 'EB', 1545, 80, 26, 'ciudad', { base: 1 }),
    I('naranja', 'Isla Naranja', 'EB', 1690, 170, 24, 'tropical'),
    I('syrup', 'Villa Syrup', 'EB', 1860, 115, 24, 'verde'),
    I('baratie', 'Baratie', 'EB', 2010, 270, 22, 'mar', { restaurante: 1 }),
    I('arlong', 'Parque Arlong', 'EB', 1745, 275, 24, 'tropical'),
    I('logue', 'Loguetown', 'EB', 2160, 175, 30, 'ciudad', { tribunal: 1, tienda: 1 }),
    // North Blue
    I('germa', 'Reino Germa', 'NB', 120, 110, 28, 'industrial'),
    I('lvneel', 'Reino Lvneel', 'NB', 300, 60, 26, 'bosque'),
    I('downs', 'Downs', 'NB', 460, 180, 24, 'rocosa'),
    I('flence', 'Flevance', 'NB', 640, 90, 24, 'blanco'),
    I('basen', 'Base G-6 del Norte', 'NB', 820, 240, 28, 'fortaleza', { base: 1 }),
    I('minion', 'Isla Minion', 'NB', 230, 270, 22, 'puerto'),
    // West Blue
    I('ohara', 'Ohara', 'WB', 150, 1070, 24, 'bosque'),
    I('ilusia', 'Reino Ilusia', 'WB', 330, 1195, 26, 'bosque'),
    I('kano', 'País Kano', 'WB', 510, 1035, 26, 'rocosa'),
    I('godvalley', 'God Valley', 'WB', 685, 1155, 26, 'jungla'),
    I('baseo', 'Base G-2 del Oeste', 'WB', 265, 1025, 28, 'fortaleza', { base: 1 }),
    // South Blue
    I('torino', 'Reino Torino', 'SB', 1400, 1035, 24, 'jungla'),
    I('baterilla', 'Baterilla', 'SB', 1575, 1175, 22, 'tropical'),
    I('bases', 'Base G-14 del Sur', 'SB', 1775, 1045, 28, 'fortaleza', { base: 1 }),
    I('quebrada', 'Isla Quebrada', 'SB', 1935, 1215, 22, 'rocosa'),
    // Franja de Calma (no se puede navegar hasta allí)
    I('lily', 'Amazon Lily', 'CB', 1060, 520, 26, 'jungla', { noNav: 1, kuja: 1 }),
    I('impel', 'Impel Down', 'CB', 1240, 520, 28, 'prision', { noNav: 1, prision: 1 }),
    I('rusukaina', 'Rusukaina', 'CB', 1580, 520, 24, 'jungla', { noNav: 1 }),
    // Línea Roja
    I('reverse', 'Monte Contracorriente', 'RL', 1300, 610, 30, 'rocosa', { entrada: 1 }),
    I('redport', 'Puerto Rojo', 'RL', 1300, 935, 22, 'ciudad', { ferryl: 1 }),
    I('geoise', 'Mary Geoise', 'RL', 1300, 120, 24, 'ciudad', { noNav: 1, gobierno: 1 }),
    // Paraíso (Gran Ruta, mitad este)
    I('cactus', 'Isla Cactus', 'PAR', 1400, 630, 22, 'desierto'),
    I('karakuri', 'Isla Karakuri', 'PAR', 1490, 845, 22, 'industrial'),
    I('whisky', 'Whisky Peak', 'PAR', 1560, 690, 24, 'rocosa'),
    I('momoiro', 'Isla Momoiro', 'PAR', 1665, 795, 22, 'tropical'),
    I('boin', 'Archipiélago Boin', 'PAR', 1715, 590, 22, 'tropical'),
    I('littlegarden', 'Little Garden', 'PAR', 1795, 855, 24, 'jungla', { dinos: 1 }),
    I('drum', 'Drum', 'PAR', 1835, 590, 24, 'nieve', { medico: 1 }),
    I('skypiea', 'Isla del Cielo', 'PAR', 1875, 735, 24, 'nubes', { cielo: 1, noNav: 1 }),
    I('arabasta', 'Reino de Arabasta', 'PAR', 1985, 630, 30, 'desierto', { forja: 1 }),
    I('jaya', 'Jaya · Mock Town', 'PAR', 2055, 815, 26, 'puerto'),
    I('longring', 'Long Ring Long Land', 'PAR', 2135, 590, 22, 'verde'),
    I('kuraigana', 'Kuraigana', 'PAR', 2205, 845, 22, 'oscuro'),
    I('water7', 'Water 7', 'PAR', 2275, 650, 28, 'agua', { astillero: 1 }),
    I('enies', 'Enies Lobby', 'PAR', 2355, 825, 24, 'ciudad', { tribunal: 1 }),
    I('thriller', 'Thriller Bark', 'PAR', 2415, 605, 26, 'oscuro', { fantasma: 1 }),
    I('sabaody', 'Archipiélago Sabaody', 'PAR', 2485, 795, 28, 'burbujas', { tienda: 1, cruce: 1 }),
    I('marineford', 'Marineford', 'PAR', 2520, 650, 30, 'fortaleza', { base: 1, cuartel: 1, tribunal: 1 }),
    // Bajo el Mar
    I('fishman', 'Isla del Hombre-Pez', 'BM', 1300, 705, 26, 'mar', { bajoMar: 1, noNav: 1 }),
    // Nuevo Mundo (mitad oeste)
    I('g5', 'Base G-5', 'NW', 110, 620, 28, 'fortaleza', { base: 1 }),
    I('hachinosu', 'Hachinosu', 'NW', 265, 765, 26, 'oscuro', { pirata: 1 }),
    I('wano', 'País de Wano', 'NW', 95, 845, 30, 'japon', { forja: 1 }),
    I('tottoland', 'Totto Land', 'NW', 515, 795, 28, 'dulce'),
    I('punk', 'Punk Hazard', 'NW', 645, 615, 26, 'fuegohielo'),
    I('dressrosa', 'Dressrosa', 'NW', 765, 805, 28, 'colorido', { arena: 1 }),
    I('greenbit', 'Green Bit', 'NW', 850, 640, 22, 'jungla'),
    I('zou', 'Zou', 'NW', 985, 795, 26, 'bosque', { elefante: 1 }),
    I('egghead', 'Egghead', 'NW', 1100, 610, 26, 'futurista', { tienda: 1 }),
    I('laugh', 'Isla JAJAJA', 'NW', 1185, 815, 24, 'calavera', { oculta: 1, final: 1 })
  ];
  D.ISLA = {};
  D.ISLAS.forEach(i => { D.ISLA[i.id] = i; });

  // Islas del juego que ya existen en el mundo vivo con otro nombre/id.
  const ENLACES = {
    dawn: 'foosha', orange: 'naranja', arlong: 'arlong', loguetown: 'logue', flevance: 'flence', whiskey: 'whisky',
    ennies: 'enies', ohara: 'ohara', reverse: 'reverse', kano: 'kano', torino: 'torino', wano: 'wano'
  };
  const REGION_MAR = { 'East Blue': 'EB', 'West Blue': 'WB', 'North Blue': 'NB', 'South Blue': 'SB', 'Grand Line': 'PAR', 'Paraíso': 'PAR', 'Nuevo Mundo': 'NW' };
  const TEMA_MAR = { EB: 'verde', WB: 'rocosa', NB: 'blanco', SB: 'tropical', PAR: 'puerto', NW: 'jungla' };
  const norm = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function posicionLibre(id, reg) {
    const R = D.REGIONS[reg];
    let h = 0;
    for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    for (const r of [18, 14, 10, 8]) {
      for (let k = 0; k < 5000; k++) {
        const x = Math.round(R.x0 + r + rnd() * (R.x1 - R.x0 - 2 * r));
        const y = Math.round(R.y0 + r + rnd() * (R.y1 - R.y0 - 2 * r));
        if (D.ISLAS.every(o => Math.hypot(o.x - x, o.y - y) >= Math.max(80, o.r + r + 30))) return { x, y, r };
      }
    }
    throw new Error(`No hay espacio para ${id} en ${reg}`);
  }

  D.vincularIslasJuego = function () {
    for (const g of getMapIslands()) {
      const nombre = g.name;
      let isla = D.ISLAS.find(i => i.juegoId === g.id || norm(i.n) === norm(nombre)) || D.ISLA[ENLACES[g.id]];
      if (!isla) {
        const reg = REGION_MAR[g.sea];
        if (!reg) throw new Error(`Mar desconocido para ${nombre}: ${g.sea}`);
        const pos = posicionLibre(g.id, reg);
        isla = I('j_' + g.id, nombre, reg, pos.x, pos.y, pos.r, TEMA_MAR[reg]);
        D.ISLAS.push(isla);
        D.ISLA[isla.id] = isla;
      }
      isla.juego = true;
      isla.juegoId = g.id;
      isla.juegoNombre = nombre;
    }
  };
  D.islaDeJuego = function (nombre) {
    const k = norm(nombre);
    return D.ISLAS.find(i => i.juego && (norm(i.juegoNombre) === k || norm(i.n) === k || i.juegoId === nombre)) || null;
  };
  D.vincularIslasJuego();

  // Temas visuales: colores [r,g,b]
  D.TEMAS = {
    verde: { land: [98, 170, 74], land2: [82, 150, 64], tree: [46, 112, 54], sand: [232, 214, 140], roof: [[178, 70, 50], [196, 124, 64]], wall: [228, 212, 182], trees: 0.42 },
    bosque: { land: [72, 140, 56], land2: [62, 126, 50], tree: [30, 94, 40], sand: [214, 200, 130], roof: [[150, 100, 60]], wall: [200, 180, 140], trees: 0.62 },
    tropical: { land: [112, 188, 80], land2: [96, 172, 70], tree: [36, 140, 72], sand: [242, 226, 152], roof: [[202, 152, 84], [170, 112, 62]], wall: [236, 222, 190], trees: 0.38, palms: 1 },
    ciudad: { land: [126, 170, 88], land2: [112, 156, 80], tree: [58, 118, 60], sand: [230, 212, 150], roof: [[86, 106, 160], [172, 82, 62], [120, 120, 132]], wall: [222, 216, 206], trees: 0.25, dense: 1 },
    desierto: { land: [226, 190, 122], land2: [212, 172, 104], tree: [150, 162, 82], sand: [238, 212, 152], roof: [[222, 202, 162], [198, 168, 120]], wall: [238, 222, 192], trees: 0.08, dense: 1 },
    nieve: { land: [236, 242, 248], land2: [214, 226, 238], tree: [42, 92, 72], sand: [208, 220, 232], roof: [[122, 62, 52], [92, 72, 62]], wall: [210, 196, 176], trees: 0.32 },
    jungla: { land: [72, 148, 52], land2: [60, 132, 46], tree: [26, 88, 36], sand: [200, 190, 120], roof: [[140, 92, 52]], wall: [190, 172, 132], trees: 0.66 },
    industrial: { land: [124, 122, 112], land2: [110, 108, 100], tree: [80, 92, 70], sand: [170, 160, 140], roof: [[92, 92, 98], [112, 82, 72]], wall: [150, 150, 152], trees: 0.1, dense: 1 },
    futurista: { land: [160, 168, 186], land2: [140, 150, 172], tree: [90, 130, 120], sand: [200, 208, 220], roof: [[70, 90, 140], [110, 130, 180]], wall: [200, 210, 226], trees: 0.08, dense: 1 },
    mar: { land: [150, 170, 120], land2: [136, 156, 110], tree: [70, 120, 70], sand: [220, 210, 170], roof: [[92, 120, 170], [182, 92, 70]], wall: [232, 222, 206], trees: 0.1, dense: 1 },
    fortaleza: { land: [152, 152, 152], land2: [134, 134, 138], tree: [100, 110, 90], sand: [180, 176, 166], roof: [[62, 62, 72], [204, 204, 204]], wall: [212, 212, 216], trees: 0.05, dense: 1 },
    oscuro: { land: [92, 82, 112], land2: [78, 70, 98], tree: [50, 40, 62], sand: [112, 102, 122], roof: [[62, 52, 72], [90, 60, 80]], wall: [122, 112, 132], trees: 0.45 },
    rocosa: { land: [150, 140, 124], land2: [132, 124, 110], tree: [90, 110, 80], sand: [200, 190, 168], roof: [[120, 100, 84]], wall: [200, 192, 176], trees: 0.12 },
    puerto: { land: [140, 160, 96], land2: [124, 146, 86], tree: [60, 110, 58], sand: [232, 218, 150], roof: [[160, 90, 60], [180, 140, 70]], wall: [224, 210, 180], trees: 0.2, dense: 1 },
    blanco: { land: [244, 244, 238], land2: [232, 232, 228], tree: [188, 200, 188], sand: [240, 236, 220], roof: [[236, 236, 240], [200, 200, 212]], wall: [250, 250, 250], trees: 0.2, dense: 1 },
    nubes: { land: [250, 250, 255], land2: [232, 238, 252], tree: [240, 222, 142], sand: [255, 255, 255], roof: [[232, 200, 110], [220, 180, 90]], wall: [252, 244, 214], trees: 0.18, clouds: 1 },
    agua: { land: [150, 170, 120], land2: [136, 156, 110], tree: [70, 120, 70], sand: [220, 210, 170], roof: [[92, 120, 170], [182, 92, 70], [210, 160, 90]], wall: [232, 222, 206], trees: 0.1, dense: 1, canals: 1 },
    burbujas: { land: [140, 178, 96], land2: [124, 160, 86], tree: [50, 120, 66], sand: [238, 226, 160], roof: [[150, 110, 180], [90, 140, 190], [210, 150, 80]], wall: [230, 224, 200], trees: 0.4, bubbles: 1 },
    dulce: { land: [240, 200, 214], land2: [228, 182, 198], tree: [150, 110, 130], sand: [248, 232, 200], roof: [[210, 120, 150], [140, 90, 150], [230, 160, 90]], wall: [252, 240, 230], trees: 0.15, dense: 1, candy: 1 },
    japon: { land: [128, 160, 92], land2: [112, 146, 82], tree: [40, 96, 46], sand: [228, 212, 148], roof: [[60, 60, 70], [180, 60, 60]], wall: [232, 218, 190], trees: 0.35, dense: 1, pagoda: 1 },
    colorido: { land: [140, 180, 84], land2: [124, 164, 74], tree: [56, 116, 54], sand: [238, 220, 146], roof: [[210, 80, 90], [80, 150, 190], [230, 160, 60], [120, 90, 170]], wall: [240, 226, 196], trees: 0.3, dense: 1 },
    fuegohielo: { land: [180, 120, 96], land2: [160, 108, 88], tree: [70, 100, 80], sand: [220, 200, 170], roof: [[200, 80, 50], [180, 210, 230]], wall: [224, 214, 200], trees: 0.2, split: 1 },
    prision: { land: [110, 112, 118], land2: [96, 98, 106], tree: [70, 86, 76], sand: [160, 162, 170], roof: [[50, 50, 58]], wall: [150, 152, 160], trees: 0.02, dense: 1 },
    calavera: { land: [200, 196, 186], land2: [182, 178, 168], tree: [120, 130, 116], sand: [214, 208, 196], roof: [[96, 92, 88], [70, 66, 62]], wall: [222, 218, 210], trees: 0.08, skull: 1 }
  };

  // ── Personajes ──
  D.NOMBRES = ['Astorr', 'Bohemio', 'Alieven', 'Ferx', 'Hbkiii', 'abraxas', 'Azar', 'chris', 'Minibull', 'Parche', 'Ratbiz', 'Greta', 'Sazyrus', 'Frater', 'Davy', 'Hugop', 'Glogary', 'Morpheo', 'Valen', 'Slacer', 'Alemanser', 'Vale', 'Nitti', 'Alvin', 'Thigaz', 'Boorsalino', 'Edxardd', 'Raulito', 'MISA', 'Nailik', 'Chormario', 'Hirayama', 'Mistress', 'TitoKaos', 'Deivid', 'Juanpie', 'Eclipsa', 'Iria', 'Marlo', 'Teo', 'Bepo', 'Shachi', 'Penguin', 'Nico', 'Kaya', 'Usopp', 'Yasopp', 'Lucky', 'Lars', 'Mone', 'Bibi', 'Kaya', 'Perla', 'Rio', 'Mato', 'Zuni', 'Vito', 'Croco', 'Dofla', 'Baby', 'Cavendish', 'Sai', 'Leo', 'Wicca', 'Cabji'];
  D.EPITETOS = ['El Estratega', 'Skull Crusher', 'El Elegido', 'El Perico Azul', 'La Tormenta Roja', 'Demonio Dorado', 'Diente de Oro', 'Mini Bull', 'Pata de Palo', 'Sirena de Agua Dulce', 'El Farol', 'Marea Alta', 'Cuchillo Lento', 'Vela Rota', 'El Almizcle', 'Niebla Blanca', 'Cazador de Calamares', 'Puño de Coral', 'Brújula Loca', 'El Ancla', 'Chispa del Sur', 'Cortamástil', 'El Borracho Serio', 'Lengua de Serpiente', 'Sal Amarilla', 'El Comedor', 'Pies Cansados', 'Mil Mapas', 'Gaviota Gris', 'El Fondo del Barril', 'Rey de la Fiesta', 'La Cuerda Floja', 'Tijera de Mar', 'El Tímido', 'Mano de Piedra', 'La Cita Falsa', 'Muy Persona', 'El Resabio', 'Cofre Ambulante', 'Trueno Chico'];
  D.CREW_ANIMAL = ['Pulpo Hambriento', 'Kraken Dormido', 'Jabalí Borracho', 'Lobo Loco', 'Escorpión Negro', 'Gaviota Pirata', 'Tiburón Sonriente', 'Caballito de Mar', 'Ballena Cantora', 'Cangrejo Vengativo', 'Avestruz Veloz', 'Murciélago Azul', 'Calamar Borracho', 'Medusa Tranquila', 'Erizo Viajero', 'Caimán Estudioso'];
  D.CREW_ADJ = ['de Plata', 'sin Bandera', 'de la Niebla', 'Amarillos', 'del Amanecer', 'Cansados', 'de Segunda Mano', 'Imbéciles', 'Honrados', 'del Mediodía', 'de Agua Dulce', 'Rojos', 'Veloces', 'de Bolsillo', 'de la Ley Seca'];
  D.NPC_CIU = ['Maria', 'Paco', 'Luisa', 'Jorge', 'Carmen', 'Raul', 'Sofia', 'Andres', 'Elena', 'Tomas', 'Paola', 'Diego', 'Rosa', 'Bruno', 'Ivan', 'Camila', 'Tito', 'Nora', 'Gael', 'Julia'];

  D.RAZAS_SIM = {
    human: { n: 'Humano' }, fishman: { n: 'Pez-Hombre', bono: { fue: 2 } }, mink: { n: 'Mink', bono: { agi: 2 } },
    threeeye: { n: 'Tres Ojos', bono: { ing: 2 } }, giant: { n: 'Gigante', bono: { fue: 4, agu: 2 } },
    sky: { n: 'Habitante del Cielo', bono: { agi: 1 } }, longlimb: { n: 'Extremidades Largas', bono: { fue: 1 } },
    tontatta: { n: 'Tontatta', bono: { agi: 1, ing: 1 } }, buccaneer: { n: 'Bucanero', bono: { fue: 1, agu: 2 } },
    lunarian: { n: 'Lunarian', bono: { fue: 3, agu: 2 } }
  };
  // razas que el Gobierno y la Marina persiguen de más (la opresión tiene Razones)
  D.OPRIMIDAS = ['fishman', 'longlimb', 'tontatta', 'buccaneer', 'lunarian'];
  D.FACCIONES = {
    pir: { n: 'Pirata', color: '#d33', grupo: 'Tripulación', cap: 'Capitán' },
    mar: { n: 'Marine', color: '#2b6cb0', grupo: 'Escuadra', cap: 'Oficial' },
    rev: { n: 'Revolucionario', color: '#c05621', grupo: 'Célula', cap: 'Coordinador' },
    caz: { n: 'Cazarrecompensas', color: '#6b46c1', grupo: 'Banda', cap: 'Jefe' },
    ciu: { n: 'Ciudadano', color: '#4a5568', grupo: 'Barrio', cap: 'Alcalde' }
  };
  D.BANDO = { mar: 'gobierno', ciu: 'gobierno', pir: 'libre', rev: 'libre', caz: 'libre' };
  D.RANGOS = {
    pir: ['Grumete', 'Tripulante', 'Oficial', 'Capitán'],
    mar: ['Recluta', 'Sargento', 'Teniente', 'Capitán-mar', 'Vicealmirante', 'Almirante'],
    rev: ['Recluta', 'Agente', 'Teniente', 'Comandante'],
    caz: ['Aprendiz', 'Perseguidor', 'Veterano', 'Leyenda'],
    ciu: ['Vecino', 'Trabajador', 'Notable', 'Alcalde']
  };
  D.RANK_MAX = { mar: { 5: 3, 4: 10 } }; // solo 3 Almirantes, 10 Vicealmirantes
  D.INCLINACIONES = ['pir', 'mar', 'rev', 'caz', 'que decida el mar'];

  // Carácter: 6 ejes al crear (polo con ventaja y precio) — idea del usuario, afinada por la referencia
  D.EJES = [
    { k: 'valor', polos: [{ n: 'Valiente', pro: 'Empieza peleas con más ganas', st: { fue: 2 } }, { n: 'Prudente', pro: 'Escapa mejor de los líos', st: { agu: 2 } }] },
    { k: 'mente', polos: [{ n: 'Listo', pro: 'Golpea primero en la pelea', st: { ing: 2 } }, { n: 'Impulsivo', pro: 'A veces golpea mucho más fuerte', st: { fue: 2 } }] },
    { k: 'trato', polos: [{ n: 'Sociable', pro: 'Hace amigos en la taberna', st: { agi: 1, ing: 1 } }, { n: 'Tímido', pro: 'Los piratas no lo cazan tanto', st: { agu: 1, agi: 1 } }] },
    { k: 'astucia', polos: [{ n: 'Astuto', pro: 'Miente mejor y huye mejor', st: { ing: 2 } }, { n: 'Honrado', pro: 'Asciende antes en su organización', st: { agu: 2 } }] },
    { k: 'genio', polos: [{ n: 'Agresivo', pro: 'Los marines lo buscan más', st: { fue: 2 } }, { n: 'Tranquilo', pro: 'Apaga las peleas hablando', st: { ing: 2 } }] },
    { k: 'lazos', polos: [{ n: 'Leal', pro: 'Sus amigos lo defienden', st: { agu: 1, ing: 1 } }, { n: 'Independiente', pro: 'Pelea mejor solo', st: { fue: 1, agi: 1 } }] }
  ];
  D.STATS = ['fue', 'agi', 'agu', 'ing'];
  D.STAT_N = { fue: 'Fuerza', agi: 'Agilidad', agu: 'Aguante', ing: 'Ingenio' };
  D.HABILIDADES = [
    { k: 'golpe', n: 'Golpe pesado', d: 'A veces tu golpe rinde el doble' },
    { k: 'lider', n: 'Líder nato', d: 'Tu tripulación pelea mejor a tu lado' },
    { k: 'esquiva', n: 'Piel de anguila', d: 'Esquivas más daño' },
    { k: 'resistir', n: 'Cuero viejo', d: 'Aguantas más castigo' },
    { k: 'vendedor', n: 'Lengua de plata', d: 'Vendes hallazgos un 20 % más caros' },
    { k: 'ojo', n: 'Ojo del halcón', d: 'Encuentras más tesoros' },
    { k: 'sonar', n: 'Nariz de tiburón', d: 'Naufragio no te encuentra nunca' },
    { k: 'nervio', n: 'Nervio de acero', d: 'Sales de la prisión antes' }
  ];

  D.SUEÑOS = [
    { k: 'libertad', n: 'Ser libre', cita: 'No me diga qué hacer y seremos amigos.', sesgo: { zarpar: 1.6, explorar: 1.2 }, color: '#e53e3e' },
    { k: 'poder', n: 'Ser el más fuerte', cita: 'A ver quién me para.', sesgo: { entrenar: 1.8, pelea: 1.6 }, color: '#dd6b20' },
    { k: 'justicia', n: 'Hacer justicia', cita: 'Esto tiene arreglo. Yo me lo pongo.', sesgo: { patrulla: 1.7, arrestar: 1.6 }, color: '#3182ce' },
    { k: 'exploracion', n: 'Verlo todo', cita: '¿Y qué habrá detrás de esa niebla?', sesgo: { explorar: 1.8, zarpar: 1.3 }, color: '#38a169' },
    { k: 'riqueza', n: 'Riqueza', cita: 'Todo se puede vender. Todo.', sesgo: { tesoro: 1.8, taberna: 0.7 }, color: '#d69e2e' },
    { k: 'conocimiento', n: 'Saberlo todo', cita: 'Un libro dice otra cosa, estoy seguro.', sesgo: { explorar: 1.3, entrenar: 1.2 }, color: '#805ad5' },
    { k: 'gloria', n: 'Fama y gloria', cita: 'Que lo cuenten en cada taberna.', sesgo: { pelea: 1.5, zarpar: 1.3 }, color: '#b7791f' },
    { k: 'lazos', n: 'Una familia de mar', cita: 'Con buena tripulación, cualquier mar es casa.', sesgo: { recluta: 1.7, taberna: 1.4 }, color: '#d53f8c' },
    { k: 'destruccion', n: 'Romerse el mundo', cita: 'Que tiemble un poco, por diversión.', sesgo: { pelea: 2.0, zarpar: 1.2 }, color: '#822727' }
  ];
  D.OFICIOS = [
    { k: 'luchador', n: 'Luchador', fx: 'Pelea mejor' },
    { k: 'espadachin', n: 'Espadachín', fx: 'Pelea mejor con espada' },
    { k: 'tirador', n: 'Tirador', fx: 'Golpea primero' },
    { k: 'navegante', n: 'Navegante', fx: 'Menos tormentas y viajes mejores' },
    { k: 'cocinero', n: 'Cocinero', fx: 'La tripulación se cura mejor' },
    { k: 'medico', n: 'Médico', fx: 'Se cura rápido en cualquier isla' },
    { k: 'carpintero', n: 'Carpintero', fx: 'Repara el barco a mitad de precio' },
    { k: 'arqueologo', n: 'Arqueólogo', fx: 'Entiende piedras antiguas' },
    { k: 'musico', n: 'Músico', fx: 'La taberna se anima cuando entra' },
    { k: 'comerciante', n: 'Comerciante', fx: 'Compra y vende mejor' }
  ];
  D.SECRETOS = [
    { k: 'panico', n: 'pánico a las tormentas', fx: { zarpar: 0.6 } },
    { k: 'gloton', n: 'glotón', fx: { taberna: 1.5 } },
    { k: 'rencoroso', n: 'rencoroso', fx: { pelea: 1.3 } },
    { k: 'dormilon', n: 'dormilón', fx: { pasear: 0.7, descansar: 1.6 } },
    { k: 'romantic', n: 'romántico', fx: { taberna: 1.2, charla: 1.4 } },
    { k: 'miedoso', n: 'miedoso', fx: { pelea: 0.7 } },
    { k: 'mania', n: 'coleccionista', fx: { tesoro: 1.4 } },
    { k: 'sabio', n: 'sabio callado', fx: { explorar: 1.3 } },
    { k: 'borracho', n: 'borracho costumbre', fx: { taberna: 1.6 } },
    { k: 'justiciero', n: 'justiciero', fx: { arrestar: 1.4, pelea: 1.1 } }
  ];

  // ── Frutas del Diablo (canon, del lorebook) ──
  D.FRUTAS = [
    { k: 'gomu', n: 'Fruta Gomu Gomu', tipo: 'Paramecia', estilo: '#e53e3e', patr: 'remolinos' },
    { k: 'mera', n: 'Fruta Mera Mera', tipo: 'Logia', estilo: '#dd6b20', patr: 'llamas' },
    { k: 'hie', n: 'Fruta Hie Hie', tipo: 'Logia', estilo: '#63b3ed', patr: 'escarcha' },
    { k: 'pika', n: 'Fruta Pika Pika', tipo: 'Logia', estilo: '#f6e05e', patr: 'destellos' },
    { k: 'ope', n: 'Fruta Ope Ope', tipo: 'Paramecia', estilo: '#68d391', patr: 'círculos' },
    { k: 'yami', n: 'Fruta Yami Yami', tipo: 'Logia', estilo: '#1a202c', patr: 'espiral' },
    { k: 'gura', n: 'Fruta Gura Gura', tipo: 'Paramecia', estilo: '#9b2c2c', patr: 'grietas' },
    { k: 'bara', n: 'Fruta Bara Bara', tipo: 'Paramecia', estilo: '#ed64a6', patr: 'cortes' },
    { k: 'zushi', n: 'Fruta Zushi Zushi', tipo: 'Paramecia', estilo: '#a0aec0', patr: 'gravedad' },
    { k: 'ito', n: 'Fruta Ito Ito', tipo: 'Paramecia', estilo: '#fbb6ce', patr: 'hilos' },
    { k: 'suna', n: 'Fruta Suna Suna', tipo: 'Logia', estilo: '#d69e2e', patr: 'arena' },
    { k: 'mochi', n: 'Fruta Mochi Mochi', tipo: 'Paramecia', estilo: '#f0e6d2', patr: 'blobs' },
    { k: 'gasu', n: 'Fruta Gasu Gasu', tipo: 'Logia', estilo: '#9ae6b4', patr: 'humo' },
    { k: 'bane', n: 'Fruta Bane Bane', tipo: 'Paramecia', estilo: '#f6ad55', patr: 'ondas' }
  ];

  // ── Objetos con historia (hallazgos) ──
  D.RAREZAS = { comun: { n: 'común', c: '#a0aec0' }, pococomun: { n: 'poco común', c: '#68d391' }, rara: { n: 'rara', c: '#63b3ed' }, epica: { n: 'épica', c: '#d6bcfa' }, legendaria: { n: 'legendaria', c: '#f6e05e' } };
  D.OBJETOS = [
    { k: 'brujula', n: 'Brújula sin aguja', r: 'comun', d: 'Apunta a ninguna parte. Un viejo juraría que apunta a casa.' },
    { k: 'red', n: 'Red remendada', r: 'comun', d: 'Nadie sabe de quién era. Emprendió más viajes que su dueño.' },
    { k: 'cuchillo', n: 'Cuchillo de muelle', r: 'comun', d: 'Sirve para pelar y para pedir respeto.' },
    { k: 'botella', n: 'Botella sellada', r: 'pococomun', d: 'Dentro hay un mensaje. Nadie quiere abrirlo delante de otros.' },
    { k: 'mapa', n: 'Mapa mordido', r: 'pococomun', d: 'A un corner le falta el pedazo que importa.' },
    { k: 'monocle', n: 'Monóculo del almirante', r: 'rara', d: 'Se cayó en una pelea de puerto. Nadie lo recogió. Tú sí.' },
    { k: 'mascara', n: 'Máscara de festival', r: 'rara', d: 'Sonríe siempre. Da un poco de miedo de noche.' },
    { k: 'espada', n: 'Espada sin nombre', r: 'rara', d: 'Fue famosa. Se le borró el nombre para no darle celos a otra.' },
    { k: 'den', n: 'Caracola transpondedor', r: 'epica', d: 'Ronda de vez en cuando. Contesta solo si le caes bien.' },
    { k: 'pone', n: 'Calco de piedra antigua', r: 'epica', d: 'Un arqueólogo lloraría. Tú solo ves rayas bonitas.' },
    { k: 'corona', n: 'Corona de feria', r: 'epica', d: 'Cartón dorado. Nadie pregunta. Nadie debe preguntar.' },
    { k: 'logpose', n: 'Log Pose de oro', r: 'legendaria', d: 'Nunca apunta a donde quieres ir. Siempre a donde tienes que ir.' }
  ];
  D.CONCHAS = [
    { k: 'blanca', n: 'Concha blanca', r: 'comun', d: 'Suena a mar dentro, como todas. La diferencia es que esta es tuya.' },
    { k: 'cantora', n: 'Concha cantora', r: 'rara', d: 'De noche tararea una canción que nadie reconoce.' },
    { k: 'lagrima', n: 'Lágrima de sirena', r: 'epica', d: 'Hay quien juraría que no es de sirena. Hay quien no jura nada.' }
  ];
  D.BOTELLAS = [
    '«Al que encuentre esto: la isla de la izquierda era la de la derecha. Un saludo.»',
    '«Perdí mi barco, mi mapa y mi paciencia. Me quedan las ganas y esta botella.»',
    '«Si eres marine, eres bienvenido a cenar. Si eres pirata, también. No mires tanto el uniforme.»',
    '«A mi tripulación le dije que era el capitán. Ahora soy el capitán. Cuidado con lo que coquinas.»',
    '«Hay un cofre que se me olvidó dónde. Si lo encuentras, la mitad es tuya. No es un truco: no sé dónde está.»',
    '«No comas el pescado azul de la isla del faro. Confía.»',
    '«Me juraron que el Log Pose apuntaba al Paraíso. Apunta a una taberna. Quizá es lo mismo.»',
    '«Si te sientes solo, ya no: te encontré yo, y yo también estaba solo.»'
  ];

  // ── Insignias de la Tarjeta del Alma ──
  D.INSIGNIAS = {
    cuborojo: { n: 'Portador de Cubo Rojo', d: 'Hallaste uno de los cuatro Cubos Rojos.', r: 'raro' },
    explorador: { n: 'Buscador de Secretos', d: 'Cinco secretos de islas descubiertos.', r: 'raro' },
    cubiazul: { n: 'Lector de Cubos Azules', d: 'Revelaste uno de los tres silencios del Siglo Vacío.', r: 'raro' },
    historiador: { n: 'Historiador Prohibido', d: 'Leíste los tres Cubos Azules: la historia oculta te pertenece.', r: 'epico' },
    rey: { n: 'Rey de los Piratas', d: 'Hallaste el Cubo Dorado en la isla final. La era nueva lleva tu nombre.', r: 'epico' },
    liberador: { n: 'Liberador', d: 'Participaste en la liberación de una isla tirano.', r: 'raro' },
    'primer cartel': { n: 'Primer cartel', r: 'oro', d: 'El Gobierno te tomó por persona de interés.' },
    bandera: { n: 'Bandera propia', r: 'oro', d: 'Fundó su propia tripulación.' },
    veterano: { n: 'Veterano', r: 'oro', d: 'Diez combates ganados.' },
    arrestos: { n: 'Mano firme', r: 'oro', d: 'Diez arrestos.' },
    cien: { n: 'Cien días de mar', r: 'negro', d: 'Cien días en el mundo.' },
    fuga: { n: 'Fuga imposible', r: 'negro', d: 'Salió del fondo de Impel Down.' },
    fruta: { n: 'Fruta maldita', r: 'negro', d: 'Comió una Fruta del Diablo. Ya no sabe nadar.' },
    descifrador: { n: 'Descifrador', r: 'negro', d: 'Reunió los cuatro rojos.' },
    final: { n: 'El final del mar', r: 'negro', d: 'Llegó a la Isla JAJAJA.' },
    nuevomundo: { n: 'Nuevo Mundo', r: 'oro', d: 'Cruzó a la segunda mitad de la Gran Ruta.' },
    cielo: { n: 'Por encima de las nubes', r: 'oro', d: 'Subió a la Isla del Cielo.' },
    bajomar: { n: 'Diez mil metros', r: 'oro', d: 'Bajó a la Isla del Hombre-Pez.' },
    cuatromares: { n: 'Los cuatro mares', r: 'oro', d: 'Pisó cada uno de los cuatro Blues.' },
    coleccionista: { n: 'Coleccionista', r: 'oro', d: 'Quince islas distintas pisadas.' },
    heredero: { n: 'La historia continúa', r: 'negro', d: 'Aprendió de un alma que se fue.' }
  };

  // ── Susurros que el jugador puede mandar a su avatar ──
  D.SUSURROS = [
    { k: 'quedate', n: 'Quédate aquí un rato', fx: { pasear: 2.2, taberna: 1.3 } },
    { k: 'cuidado', n: 'Ten cuidado', fx: { pelea: 0.5, explorar: 0.8 } },
    { k: 'descansar', n: 'Descansa', fx: { descansar: 3 } },
    { k: 'explorar', n: 'Explora la isla', fx: { explorar: 3.5 } },
    { k: 'tesoro', n: 'Busca tesoros', fx: { tesoro: 2.6, explorar: 1.2 } },
    { k: 'taberna', n: 'Ve a la taberna', fx: { taberna: 3 } },
    { k: 'entrenar', n: 'Entrena', fx: { entrenar: 3.2 } },
    { k: 'pelea', n: 'Pelea con alguien', fx: { pelea: 3 } },
    { k: 'zarpar', n: 'Zarpa a otra isla', fx: { zarpar: 4 } },
    { k: 'amigos', n: 'Haz amigos', fx: { taberna: 1.8, charla: 2.4 } }
  ];
})(typeof window !== 'undefined' ? window : globalThis);

export const islaDeJuego = (nombre) => (typeof window !== 'undefined' ? window : globalThis).D.islaDeJuego(nombre);
