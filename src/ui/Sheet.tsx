import type { ComponentChildren } from 'preact';

export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="grip" />
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}
