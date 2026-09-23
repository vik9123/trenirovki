let ctx: AudioContext | null = null;

/** Звук в браузере разрешён только после жеста — вызывать из обработчика нажатия. */
export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Три коротких сигнала: конец отдыха. */
export function beep(): void {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime;
  [0, 0.28, 0.56].forEach((d, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.5, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
    o.connect(g).connect(c.destination);
    o.start(t + d);
    o.stop(t + d + 0.22);
  });
}

/** Вибрация есть на Android; на iPhone в браузере её нет — вызов просто ничего не делает. */
export function buzz(): void {
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    /* нет вибрации */
  }
}
