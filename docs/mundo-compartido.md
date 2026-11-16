# Mundo compartido

GitHub Pages sirve solamente el cliente. Por defecto no hay ninguna base de datos configurada: Vista Mundial indica «Simulación local» y el avatar, su inventario y el estado geopolítico local se guardan en `localStorage`. El mundo local persiste al reiniciar el avatar; borrar los datos del sitio lo elimina.

## Módulos del cliente

`src/config.js` centraliza paleta, claves y contratos; `src/storage_adapter.js` es la única capa que accede al almacenamiento del navegador. `src/network.js` gestiona la sincronización con Supabase y usa ese adaptador para sus datos locales. `src/event_dispatcher.js` valida y distribuye eventos de bitácora/noticias/chat, `src/chat_engine.js` mantiene el Chat Global y el historial privado de susurros, y `src/time_engine.js` calcula el avance del reloj. Los catálogos descriptivos, incluidos los habitantes visuales de los puertos, viven en `src/data/islands_data.json` y `src/data/missions_data.json`.

Acerca el mapa con la rueda o un pellizco sobre el marcador de una isla para entrar en su vista urbana; aleja para regresar al globo. También se puede seleccionar una isla con un toque. Los habitantes se animan solo mientras su vista está visible y se detienen al abrir un modal o activar movimiento reducido. La selección de un destino se puede proponer desde Más > Vista mundial.

## Conectar Supabase

1. Crea un proyecto dedicado y habilita **Anonymous Sign-Ins** en Supabase Auth. Si se usa en producción, configura protección contra abuso y límites de uso.
2. Ejecuta `supabase/world.sql` en el editor SQL. Crea las tablas, sus políticas de lectura y las funciones transaccionales de acciones; los clientes no reciben permisos directos de escritura. Si ya desplegaste una versión anterior, vuelve a ejecutar el script para instalar la tabla de frutas únicas, el evento de Chat Global y las actualizaciones de esquema.
3. En `src/network-config.js`, introduce la URL HTTPS del proyecto y su clave **publishable/anon** pública. Nunca incluyas una clave `service_role`, contraseña ni token de acceso. Publica el cambio en Pages.
4. Para ejecutar el ciclo de fugas sin depender de navegadores conectados, habilita `pg_cron` en el proyecto y, como administrador, ejecuta:

   ```sql
   select cron.schedule('one-latam-world-cycle', '0 * * * *',
     'select public.advance_world_cycle()');
   ```

   La función no es accesible para usuarios anónimos o autenticados. También avanza el ciclo global de reencarnación de las Akuma no Mi. Las ubicaciones de los fugados permanecen en una tabla sin acceso para clientes.

Vista Mundial muestra el estado de conexión y cualquier error; Más > Estado de Red permite solicitar una sincronización. El cliente consulta el mundo cada 30 segundos y al recuperar la conexión. Los eventos públicos, incluido el Chat Global (nunca el texto de un susurro privado), se conservan en una cola local hasta recibir confirmación; al conectarse se reintentan con identificadores idempotentes. Sin configuración, los mensajes globales y el resto de la simulación permanecen en este navegador y no se comparten.

Al volver a abrir o activar la página, la partida simula hasta ocho horas de acciones pendientes, siempre que no estuviera pausada ni terminada; el límite se registra en la bitácora. Las acciones públicas simuladas se agregan a la cola para sincronizarlas al reconectar.

El reloj personal avanza cinco minutos de juego por cada 75 segundos reales: una hora de juego por cada 15 minutos reales. Los pulsos parciales se conservan entre guardados. Las decisiones mostradas al jugador esperan 60 segundos; si vencen o la partida se recupera sin conexión, el avatar decide según sus rasgos. Los ciclos de fuga locales se procesan al avanzar un día de juego. El reloj personal no es un reloj compartido autoritativo: el ciclo de servidor de Supabase requiere `pg_cron` como se describe arriba.

El botón de pausa ya no está disponible. Las partidas guardadas que estaban pausadas se reanudan al abrirlas, sin simular el tiempo que pasaron en pausa. Con la página en segundo plano, el temporizador de simulación se detiene y el progreso se calcula al volver; el globo también deja de animarse cuando está cubierto por un modal.

Las frutas del diablo se reclaman mediante una función SQL atómica, por lo que solo una sesión puede poseer cada fruta a la vez. La muerte libera la fruta para su reaparición en el siguiente ciclo global; sin Supabase, el mismo sistema funciona localmente en el navegador. Las razas, el Haki, la captura y el rescate también se simulan en el cliente y no son resultados autoritativos.

## Límites de confianza

La sesión anónima permite asociar capitanes a un navegador y las políticas impiden modificar directamente tablas compartidas o sobrescribir un capitán de otra sesión. Sin embargo, las partidas personales y los resultados de combate se calculan en el cliente: un usuario modificado puede falsificar sus propias hazañas o recompensa. Esta integración es un prototipo compartido, **no un servidor autoritativo ni una clasificación resistente a trampas**. Antes de usarla competitivamente, traslada validación, combate, recompensas y conquistas a un servicio autoritativo, añade autenticación recuperable y moderación.

Los mapas y notas publicados en el Panteón son públicos. No envíes información personal mediante nombres o datos de juego. Borrar los datos del navegador elimina la sesión anónima y puede impedir recuperar su propiedad.
