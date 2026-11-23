const extensions = new Map();
const NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function registerExtension(name, data) {
  if (!NAME_PATTERN.test(name) || !isRecord(data)) {
    throw new TypeError("Una extensión requiere un nombre válido y un objeto JSON.");
  }
  if (extensions.has(name)) throw new Error(`La extensión "${name}" ya está registrada.`);
  extensions.set(name, structuredClone(data));
  return getExtension(name);
}

export function getExtension(name) {
  const data = extensions.get(name);
  return data ? structuredClone(data) : null;
}

export function listExtensions() {
  return [...extensions.keys()];
}

export const DataLoader = Object.freeze({ registerExtension, getExtension, listExtensions });
