import { useEffect, useState } from 'preact/hooks';
import { formatDuration } from '../lib/format';

/** Секундомер тренировки; перерисовывает только себя. */
export function Clock({ start, end }: { start: number; end?: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);
  return <>{formatDuration((end ?? now) - start)}</>;
}
