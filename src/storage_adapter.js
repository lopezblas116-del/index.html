export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStorage(key, storage = browserStorage()) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key, value, storage = browserStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key, storage = browserStorage()) {
  try {
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key, fallback, storage = browserStorage()) {
  const raw = readStorage(key, storage);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value, storage = browserStorage()) {
  try {
    return writeStorage(key, JSON.stringify(value), storage);
  } catch {
    return false;
  }
}
