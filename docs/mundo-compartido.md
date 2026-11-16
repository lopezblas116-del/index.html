# Mundo compartido

GitHub Pages sirve solamente el cliente. Por defecto no hay ninguna base de datos configurada: Vista Mundial indica «Simulación local» y el estado geopolítico local vive en memoria. El avatar y su inventario siguen en `localStorage`.

## Conectar Supabase

1. Crea un proyecto dedicado y habilita **Anonymous Sign-Ins** en Supabase Auth. Si se usa en producción, configura protección contra abuso y límites de uso.
2. Ejecuta `supabase/world.sql` una sola vez en el editor SQL. Crea las tablas, sus políticas de lectura y la función transaccional de acciones; los clientes no reciben permisos directos de escritura.
3. En `src/network-config.js`, introduce la URL HTTPS del proyecto y su clave **publishable/anon** pública. Nunca incluyas una clave `service_role`, contraseña ni token de acceso. Publica el cambio en Pages.
4. Para ejecutar el ciclo de fugas sin depender de navegadores conectados, habilita `pg_cron` en el proyecto y, como administrador, ejecuta:

   ```sql
   select cron.schedule('one-latam-world-cycle', '0 * * * *',
     'select public.advance_world_cycle()');
   ```

   La función no es accesible para usuarios anónimos o autenticados. Las ubicaciones de los fugados permanecen en una tabla sin acceso para clientes.

Vista Mundial muestra el estado de conexión y cualquier error. El cliente consulta el mundo cada 30 segundos y al recuperar la conexión. Los eventos públicos sin texto del susurro se conservan en una cola local hasta recibir confirmación; al conectarse se reintentan con identificadores idempotentes. Si el almacenamiento del navegador falla, la interfaz avisa que la cola solo existe durante la sesión. Sin configuración, no se envían eventos y la simulación local no se comparte.

Al volver a abrir o activar la página, la partida simula hasta ocho horas de acciones pendientes, siempre que no estuviera pausada ni terminada; el límite se registra en la bitácora. Las acciones públicas simuladas se agregan a la cola para sincronizarlas al reconectar.

## Límites de confianza

La sesión anónima permite asociar capitanes a un navegador y las políticas impiden modificar directamente tablas compartidas o sobrescribir un capitán de otra sesión. Sin embargo, las partidas personales y los resultados de combate se calculan en el cliente: un usuario modificado puede falsificar sus propias hazañas o recompensa. Esta integración es un prototipo compartido, **no un servidor autoritativo ni una clasificación resistente a trampas**. Antes de usarla competitivamente, traslada validación, combate, recompensas y conquistas a un servicio autoritativo, añade autenticación recuperable y moderación.

Los mapas y notas publicados en el Panteón son públicos. No envíes información personal mediante nombres o datos de juego. Borrar los datos del navegador elimina la sesión anónima y puede impedir recuperar su propiedad.
