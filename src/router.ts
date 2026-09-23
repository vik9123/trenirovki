import { useEffect, useState } from 'preact/hooks';

export function go(path: string): void {
  location.hash = path;
}

/** Текущий путь из location.hash: «#/w/5» → «/w/5». */
export function useRoute(): string {
  const read = () => location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => {
      setPath(read());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return path;
}
