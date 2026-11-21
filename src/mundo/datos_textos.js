// Textos del mundo: plantillas de sucesos, charlas de taberna, frases de sueno.
// Los marcadores: {a} {b} {isla} {dest} {crew} {corta} {n} {por} ...
(function (G) {
  const D = (G.D = G.D || {});

  // Plantillas del feed. imp: importancia 1-9 (>=4 va al periódico).
  D.TXT = {
    zarpar: { t: '{a} zarpa de {isla} rumbo a {dest}.', imp: 2 },
    atraca: { t: '{a} atraca en {isla}.', imp: 1 },
    navega: { t: '{crew} navega de {isla} a {dest}.', imp: 1 },
    pelea: { t: 'Pelea en {isla}: {a} contra {b}.', imp: 3 },
    pelea_gana: { t: '{a} gana a {b} en {isla}. {por}', imp: 3 },
    derrota: { t: '{a} derrota a {b} en {isla}. {por}', imp: 3 },
    pelea_mar: { t: 'Pelea en el puerto de {isla}: {a} gana a {b}. {por}', imp: 3 },
    arresto: { t: '{a} pilla a {b} en {isla} y se lo lleva al calabozo.', imp: 4 },
    arresto_gran: { t: '{a} arresta a {b} ({recompensa}). {por}', imp: 5 },
    rescate: { t: '{a} saca a {b} del calabozo antes del amanecer. Sin preguntar a nadie.', imp: 5 },
    robo: { t: '{a} robó una bolsa en la taberna de {isla}. Nadie vio nada. Casi nadie.', imp: 3 },
    robo_pilla: { t: 'Pillaron a {a} con la mano en el bolsillo de {b} en {isla}. Mala noche.', imp: 3 },
    ronda: { t: '{a} invita a una ronda en {isla}. El barrio le cae mejor que ayer.', imp: 2 },
    monedas: { t: '{a} encuentra una bolsa con {n} Belis en {isla}.', imp: 1 },
    reliquia: { t: '{a} encuentra {obj} en {isla}.', imp: 3 },
    hallazgo: { t: '{a} devuelve su ancla al barco fantasma de {isla}. La niebla le acompaña.', imp: 4 },
    explora: { t: '{a} explora {isla} de punta a punta.', imp: 1 },
    primera: { t: '{a} pisa {isla} por primera vez y su nombre queda grabado en ella.', imp: 5 },
    recluta: { t: '{a} se une al {crew}.', imp: 2 },
    funda: { t: '{a} funda el {crew} en {isla}.', imp: 4 },
    robarco: { t: '{a} roba un barco en el puerto de {isla}. El capitán jurará que era suyo.', imp: 4 },
    abandona: { t: '{a} deja el {crew}. No hubo discusión: hubo silencio.', imp: 2 },
    nuevoCap: { t: '{a} toma el mando del {crew}.', imp: 3 },
    tormenta: { t: 'Tormenta sobre el mar de {isla}. Los barcos aguantan como pueden.', imp: 2 },
    naufragio: { t: 'La tormenta hunde el {crew} cerca de {isla}. Hay náufragos nadando.', imp: 4 },
    reymar: { t: 'Un Rey Marino asoma cerca de {isla}. El mar se queda quieto.', imp: 5 },
    festival: { t: 'Festival en {isla}: la taberna llena hasta la mañana.', imp: 2 },
    rumor: { t: 'Corre un rumor en {isla}: se dice que hay un cofre escondido durante dos días.', imp: 2 },
    compra: { t: '{a} compra provisiones en el mercado de {isla}.', imp: 1 },
    poneglyph: { t: '{a} descifra un fragmento de Poneglyph en {isla}. La historia oculta habla.', imp: 6 },
    flota: { t: 'Una flota Marine persigue al {crew} por el mar de {isla}.', imp: 4 },
    cartel: { t: 'Nuevo cartel en {isla}: {a} ahora vale {recompensa}.', imp: 5 },
    despierta: { t: '{a} despierta en la playa de {isla}. El mar se llevó lo que pudo y le dejó la voluntad.', imp: 5 },
    secreto: { t: '{a} descubre un secreto de {isla}: {obj}.', imp: 5 },
    pistaCubo: { t: 'En la taberna de {isla} una voz ronca susurra: «{obj}».', imp: 3 },
    cuboHallado: { t: '{a} levanta un Cubo Rojo en {isla}. El mundo entero lo sentirá.', imp: 7 },
    cuboRival: { t: 'El {crew} se hace con un Cubo Rojo en {isla}. La carrera por el mundo ha empezado.', imp: 6 },
    cubosFin: { t: 'Los cuatro Cubos Rojos brillan reunidos. La isla final abre sus puertas: una era termina y otra comienza.', imp: 8 },
    sube: { t: 'El cartel de {a} sube a {recompensa}.', imp: 4 },
    rebaja: { t: 'El cartel de {a} baja a {recompensa}. Portarse bien funciona.', imp: 2 },
    supernova: { t: '{a} pasa de los 100 millones. Candidato a Emperador, dicen en {isla}.', imp: 6 },
    emperador: { t: '{a} es uno de los Cuatro Emperadores del Nuevo Mundo.', imp: 8 },
    juicio: { t: 'Juicio público en {isla}: {a} responde por sus carteles.', imp: 5 },
    fuga: { t: '{a} sale de prisión con una historia que nadie le va a creer entera.', imp: 4 },
    perfil: { t: '{a} anda con perfil bajo tras salir del calabozo de {isla}.', imp: 2 },
    amistad: { t: '{a} y {b} se hacen amigos en {isla}.', imp: 2 },
    rivalidad: { t: '{a} y {b} se empiezan a odiar en {isla}. Empieza bien: con insultos.', imp: 2 },
    reencuentro: { t: '{a} y {b} se reencuentran en {isla}. Abrazo de los que duelen.', imp: 3 },
    desertor: { t: '{a} rompe con su bando en {isla} y empieza de cero.', imp: 4 },
    encrucijada: { t: '{a} cambia de bando: ahora es {fac}.', imp: 5 },
    fruta: { t: '{a} encontró {fruta} y la comió entera. Ya no sabe nadar.', imp: 6 },
    maestria: { t: 'La {fruta} de {a} gana fuerza (maestría {n}).', imp: 3 },
    nivel: { t: '{a} llega a nivel {n}.', imp: 1 },
    habilidad: { t: '{a} aprende «{hab}».', imp: 3 },
    cava: { t: '{a} cava en el pozo del Oro Rosa. El pozo baja a {n} metros.', imp: 2 },
    hito: { t: 'El pozo del Oro Rosa llega a {n} metros. Algo brilla en el fondo.', imp: 4 },
    pozoFin: { t: '¡El pozo del Oro Rosa toca fondo! Se reparte el cofre entre los que cavaron.', imp: 7 },
    heredero: { t: '{a} se fue en {isla}. Su heredero {b} recoge su bandera.', imp: 7 },
    bloqueo: { t: 'La Marina bloquea el puerto de {isla}.', imp: 5 },
    orden: { t: '{a} manda una orden al {crew}: «{corta}».', imp: 2 },
    hoyNo: { t: '{a} responde a su capitán en público: «Hoy no».', imp: 3 },
    susurroSi: { t: '{a} atiende el susurro de su dueño y decide {corta}.', imp: 2 },
    susurroNo: { t: '{a} sonríe al consejo de su dueño y hace otra cosa.', imp: 1 },
    reinterpret: { t: 'A {a} le sugieren «{corta}». Hace su propia versión.', imp: 2 }
  };

  // Motivos narrativos de victoria ("por")
  D.PORQUE = [
    'Ganó por fuerza, aunque el otro era más rápido.',
    'Ganó por agilidad.',
    'Ganó con astucia: el otro nunca vio de dónde vino.',
    'Ganó por aguante: se comió todos los golpes y siguió de pie.',
    'Ganó con ayuda de su tripulación.',
    'Ganó por ingenio, usando la isla en su contra.',
    'Ganó porque el otro estaba cansado.',
    'Ganó por experiencia: se le notan los días de mar.'
  ];

  // Charlas guionizadas (formato de la referencia). rel: mal|bien|neutro.
  // Condiciones opcionales: fac (par de facciones), rasgo (del que habla), isl (isla concreta), noche.
  // Los *insultos* se pintan en rojo con sacudida.
  D.CHARLAS = [
    // ── Piques (rel mal) ──
    { cat: 'pique', rel: 'mal', l: [['A', 'Mira quién ha vuelto. ¿Te escupió el mar otra vez?'], ['B', 'Hasta el mar tiene estómago. No como tu barco, que vomita marineros.'], ['A', 'Mi barco por lo menos flota. El tuyo es un barreño con ínfulas.'], ['B', 'Un barreño que te adelantó en la última travesía, *percebe con sombrero*.'], ['A', '*Lapa de muelle*. Te pegas a cualquiera que invita a una ronda.'], ['B', 'Y tú no invitas ni a agua salada.']] },
    { cat: 'pique', rel: 'mal', l: [['A', 'Me han dicho que te eligieron capitán por unanimidad.'], ['B', 'Por unanimidad, sí.'], ['A', 'Normal. El otro candidato era una cabra.'], ['B', 'Y aun así la cabra se llevó tu voto, *zoquete*.'], ['A', 'Le voté porque tenía mejor barba que tú.'], ['B', 'Eso no es un insulto. Es un dato.']] },
    { cat: 'pique', rel: 'mal', fac: ['mar', 'pir'], l: [['A', 'Ese cartel tuyo da pena. Mi sobrino vale más y solo roba galletas.'], ['B', 'Tu sobrino tiene más futuro que tú, y eso que aún no sabe atarse las botas.'], ['A', 'Te voy a meter en un calabozo tan pequeño que respirarás por turnos.'], ['B', 'Ese uniforme te queda como un guante a un pulpo.'], ['A', '*Pirata de bañera*.'], ['B', '*Ancla con patas*. Por lo menos yo floto.']] },
    { cat: 'pique', rel: 'mal', rasgo: 'Agresivo', l: [['A', 'Me has tirado la cerveza.'], ['B', 'Te la he mejorado. Ahora sabe a suelo.'], ['A', 'Repite eso.'], ['B', 'Sabe. A. Suelo. ¿Te lo escribo o tampoco sabes leer?'], ['A', 'Mañana en el muelle, a remo. El que pierda friega la cubierta del otro.'], ['B', 'Trae tu propio cubo. El mío no lo toca cualquiera.']] },
    { cat: 'pique', rel: 'mal', l: [['A', 'Hueles a red de pesca olvidada en la playa.'], ['B', 'Y tú a bodega que nadie ha abierto en diez años.'], ['A', 'Es perfume de aventura.'], ['B', 'Es humedad, *calamar reseco*.'], ['A', 'Pues tu aventura huele a sardina de lata.'], ['B', 'Sardina viajada. Algo que tú no sabes lo que es.']] },
    { cat: 'pique', rel: 'mal', l: [['A', '¿Ese es el tesoro que tanto contabas?'], ['B', 'Es una caja fuerte. No se abre porque sí.'], ['A', 'Se abre con llave. ¿La tienes?'], ['B', 'La tengo. La llave es otra cosa, *cofre con candado mental*.'], ['A', 'Pues guarda la caja en el mismo sitio que la llave.'], ['B', 'Ese es el problema.']] },
    // ── Picaresca (rel bien/neutro) ──
    { cat: 'picaresca', rel: 'neutro', l: [['A', 'Te vendo un mapa del tesoro. Auténtico. Solo 50.000 Belis.'], ['B', '¿Y por qué no vas tú a por el tesoro?'], ['A', 'Porque soy generoso. Y porque me mareo.'], ['B', 'Aquí la X está en mitad del mar.'], ['A', 'El tesoro es el viaje.'], ['B', 'Entonces el viaje vale 25.000, y ya te estoy pagando de más.']] },
    { cat: 'picaresca', rel: 'neutro', l: [['A', 'Ayer pesqué un pez así de grande.'], ['B', 'Ayer estuviste durmiendo en la taberna hasta mediodía.'], ['A', 'Lo pesqué en sueños. Cuenta igual.'], ['B', 'Entonces yo soy Almirante, rico y guapo.'], ['A', 'Tampoco te pases. En los sueños también hay límites.']] },
    { cat: 'picaresca', rel: 'bien', l: [['A', 'Si alguien pregunta, anoche estuviste conmigo.'], ['B', 'Anoche no estuviste conmigo.'], ['A', 'Por eso te lo pido ahora y no anoche.'], ['B', '¿Qué hiciste?'], ['A', 'Nada malo. Unos dados. Un barril. Una cabra que no era mía.'], ['B', 'Eso son dos rondas. Una por mentir y una por la cabra.']] },
    // ── Amigos ──
    { cat: 'amigos', rel: 'bien', l: [['A', '¿Desde cuándo no nos veíamos?'], ['B', 'Desde el naufragio. Tú te fuiste con el bote.'], ['A', 'Y volví con refuerzos.'], ['B', 'Volvió con el bote.'], ['A', 'El bote era el refuerzo, *optimista con remo*.'], ['B', 'Por algo eres mi capitán.']] },
    { cat: 'amigos', rel: 'bien', l: [['A', 'Guardé tu parte del botín.'], ['B', '¿Toda?'], ['A', 'La que sobró.'], ['B', '¿Cuánto sobró?'], ['A', 'Depende de cómo miremos lo que gasté.'], ['B', 'Mirémoslo de lejos, *tesorero de bolsillo roto*.']] },
    { cat: 'amigos', rel: 'bien', l: [['A', '¿Y si zarpamos juntos otra vez?'], ['B', 'Tu barco se hundió en la última.'], ['A', 'Se hundió heroicamén... digo, heroica'], ['B', 'Se hundió en el puerto.'], ['A', 'Los puertos también tienen sus peligros, *valiente de muelle*.'], ['B', 'Tienes el valor bien guardado.']] },
    { cat: 'amigos', rel: 'bien', noche: 1, l: [['A', 'La noche está bonita.'], ['B', 'Demasiada luna para tanto rumor.'], ['A', '¿Y si mañana zarpa al amanecer?'], ['B', 'El amanecer nunca llega cuando se le cita.'], ['A', 'Entonces zarpa sin cita.'], ['B', 'Hecho. El capitán lo llamamos ahora, *madrugador de palabra*.']] },
    // ── Profundas ──
    { cat: 'profunda', rel: 'bien', l: [['A', '¿Nunca te has preguntado qué hay al final del mar?'], ['B', 'Una taberna. Siempre hay una taberna.'], ['A', 'Puede. Pero tú la habrás ganado.'], ['B', 'Eso no se gana, se paga. Con los años.'], ['A', 'Entonces que me quede debiendo.'], ['B', 'Eso dijiste la última vez, *moroso filosófico*.']] },
    { cat: 'profunda', rel: 'neutro', l: [['A', 'Mi sueño es ser libre.'], ['B', '¿Libre de qué?'], ['A', 'De que me digan hacia dónde zarpar.'], ['B', 'Y yo quiero que me digan. Va mejor el viaje.'], ['A', 'Pues sácate la bandera y nos vemos en el mismo sitio igual.'], ['B', 'En la taberna.']] },
    { cat: 'profunda', rel: 'bien', l: [['A', 'Si me pillan algún día, no vengas a buscarme.'], ['B', 'Voy a venir.'], ['A', 'Es una orden.'], ['B', 'No me das órdenes. Ese es el trato entre nosotros, *capitán de por vida*.'], ['A', '...Gracias.'], ['B', 'De nada. Lleva calzado cómodo en la celda.']] },
    // ── Chismes ──
    { cat: 'chisme', rel: 'neutro', l: [['A', '¿Sabes quién anduvo borrando carteles?'], ['B', 'No diga nombres en voz alta.'], ['A', 'Ni en voz baja. Lo pongo con gestos.'], ['B', 'Mal gesto, además.'], ['A', 'El gesto lo hago yo como quiero, *dramaturgo de muelle*.'], ['B', 'Pues dile lo del gesto al juez también.']] },
    { cat: 'chisme', rel: 'neutro', l: [['A', 'Dicen que el pozo del Oro Rosa ya está a 100 metros.'], ['B', 'Dicen. ¿Quiénes?'], ['A', 'Los que cavan.'], ['B', 'Los que cavan dicen mucho y bajan poco, *ingeniero de brazos cruzados*.'], ['A', 'Bajan más que tú.'], ['B', 'Eso seguro.']] },
    { cat: 'chisme', rel: 'neutro', isl: 'baratie', l: [['A', 'En el Baratie el cocinero te patea si protestas.'], ['B', 'Si protestas con razón, te patea dos veces.'], ['A', '¿Y si protestas sin razón?'], ['B', 'Ah, entonces te contrata.'], ['A', '¿Como qué?'], ['B', 'Como ejemplo, *filósofo de cocina*.']] },
    { cat: 'chisme', rel: 'neutro', noche: 1, l: [['A', 'Dicen que de noche hay un barco fantasma.'], ['B', 'Dicen. Yo nunca lo he visto.'], ['A', 'Porque vas borracho.'], ['B', 'El fantasma y yo tenemos eso en común, *navegante de hielo seco*.'], ['A', 'Por lo menos el fantasma no tropieza.'], ['B', 'Por lo menos yo no debo un ancla.']] }
  ];

  // Frases al zarpar del avatar (primeras palabras)
  D.PRIMERAS = {
    libertad: 'El mar no tiene dueño. Voy a comprobarlo.',
    poder: 'Que se aparten los fuertes. Ahora vengo yo.',
    justicia: 'Hay cosas que se arreglan hablando. Las otras, zarpar.',
    exploracion: '¿Qué habrá detrás del horizonte? Solo una forma de saberlo.',
    riqueza: 'El mundo está lleno de cofres mal contados.',
    conocimiento: 'Cada isla guarda una pregunta. Voy a por las respuestas.',
    gloria: 'Que digan mi nombre en cada puerto. Aunque sea mal.',
    lazos: 'Voy a buscar gente para zarpar. La familia se elige.',
    destruccion: 'No sé todavía qué romperé primero. Eso lo decide el mar.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
