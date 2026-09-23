// localStorage может быть недоступен (приватный режим) — всё в try/catch, приложение работает и без него.

export function readLocal<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* нет хранилища */
  }
}
