import { useCallback, useEffect, useState } from 'preact/hooks';

/** Загрузить данные и перезагрузить по reload(). */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let alive = true;
    load().then(
      (d) => alive && (setData(d), setError(null)),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      alive = false;
    };
  }, [...deps, version]);
  return { data, error, reload, setData };
}
