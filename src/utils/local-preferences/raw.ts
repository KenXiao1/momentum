export function getRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // best-effort: only the storage-mode choice and hint use this; a lost write asks again next launch
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // best-effort: only the storage-mode choice and hint use this; a lost write asks again next launch
  }
}

export function getAllKeys(): string[] {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}
