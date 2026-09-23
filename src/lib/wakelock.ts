import { useEffect } from 'preact/hooks';

/** Не давать экрану гаснуть, пока active. Блокировка снимается при сворачивании — запрашиваем снова. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* браузер отказал — работаем без блокировки */
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      document.removeEventListener('visibilitychange', request);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
