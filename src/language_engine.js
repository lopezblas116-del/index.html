const LATIN = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
const GLYPHS = "◇△▽○●□■☆※⌘⌖⌗⌬⌭⌮⌯⌰⌱⌲⌳⌴⌵⌶⌷⌸⌹⌺";

function shiftFor(key) {
  if (typeof key !== "string" || !key.length) throw new TypeError("Se requiere una clave de glifos.");
  return [...key].reduce((sum, char) => (sum * 31 + char.codePointAt(0)) >>> 0, 7) % LATIN.length;
}

function transform(text, key, direction) {
  const shift = shiftFor(key) * direction;
  return [...String(text)].map((char) => {
    if (direction > 0) {
      const index = LATIN.indexOf(char.toLocaleUpperCase("es"));
      return index < 0 ? char : GLYPHS[(index + shift + LATIN.length) % LATIN.length];
    }
    const glyphIndex = GLYPHS.indexOf(char);
    return glyphIndex < 0 ? char : LATIN[(glyphIndex + shift + LATIN.length) % LATIN.length];
  }).join("");
}

export function encodeGlyphs(text, key) {
  return transform(text, key, 1);
}

export function decodeGlyphs(glyphs, key) {
  return transform(glyphs, key, -1);
}
