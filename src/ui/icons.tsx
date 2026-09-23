const P = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;

export const IconToday = () => (
  <svg viewBox="0 0 24 24" {...P}><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" /></svg>
);
export const IconHistory = () => (
  <svg viewBox="0 0 24 24" {...P}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
);
export const IconChart = () => (
  <svg viewBox="0 0 24 24" {...P}><path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" /></svg>
);
export const IconMore = () => (
  <svg viewBox="0 0 24 24" {...P}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
);
export const IconBack = () => <svg viewBox="0 0 24 24" {...P}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconNext = () => <svg viewBox="0 0 24 24" {...P}><path d="M9 5l7 7-7 7" /></svg>;
export const IconList = () => <svg viewBox="0 0 24 24" {...P}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>;
export const IconCheck = () => <svg viewBox="0 0 24 24" {...P} stroke-width={3}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconMenu = IconMore;
