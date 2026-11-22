# One-Latam RPG — Bitácora del Mar

RPG autónomo de aventuras marítimas con globo náutico interactivo, inspirado en el universo de One Piece. Interfaz moderna de azul profundo y oro (tipografía Anton + Manrope), ilustraciones pixel art para avatares y escenas, y un mundo con profundidad política: cada acción deja una huella con causa y efecto.

## Cómo jugar

1. Crea tu avatar en el wizard de zarpe (aspecto, trasfondo escrito, bando y brújula ideológica).
2. El globo es el mapa: gira, acércate con el zoom y entra en la vista de isla.
3. No mandas al avatar directamente: le envías **susurros** y su carácter decide.
4. La partida, el periódico y el linaje se guardan en `localStorage`.

## Profundidad del mundo (causa y efecto)

- **Marea política** — saquear el tributo celestial, sabotear puertos tiránicos o atacar a un noble desplaza tu relación con la Marina, la Revolución y el hampa; cada eco cambia precios portuarios, vigilancia naval y encuentros en alta mar. La lectura vive en *Vista Mundial*.
- **Impuestos y revueltas** — una soberanía propia con impuestos abusivos enciende el puerto día a día: primero disturbios, luego revuelta y derrocamiento. Una tasación justa calma las aguas.
- **Discriminación sistémica** — los puertos segregados cobran +50% a las razas no humanas, les cierran la taberna y los astilleros les niegan encargos; la sangre perseguida (Lunarian, Bucanero) se paga más alto en las subastas clandestinas. Ganar la confianza de la Revolución abre puertas que la ley cierra.
- **Haki con resonancia** — vencer batallas peligrosas en la Grand Line afila la voluntad: la resonancia baja el umbral de cicatrices y duplica la probabilidad de despertar. El Haki del Conquistador despierta sobrevivir al límite.
- **Akuma no Mi** — frutas únicas con ciclo de reencarnación local; el mar les quita la capacidad de nadar y la maestría crece al borde de la derrota.
- **Periódico del mar** — 31 titulares de mundo con textura del universo (nobles, Yonko, tributos, subastas) y 10 dilemas morales de puerto.

## Desarrollo y publicación

Se necesita Node.js 22. Ejecuta `npm ci` y `npm run dev` para desarrollar, `npm test` para las pruebas (149) y `npm run build` para generar `dist/`. `npm run preview` permite comprobar la compilación local. GitHub Actions compila en cada push y publica `dist/` en GitHub Pages (fuente: **GitHub Actions**).

La Enciclopedia del Mar (catálogo del mundo, 341 entradas) está íntegramente en español; su texto alimenta los encuentros de isla («Según los registros del mundo…»).

Detalles técnicos y de red compartida: ver [docs/mundo-compartido.md](docs/mundo-compartido.md).
