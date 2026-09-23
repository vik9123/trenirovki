import { IconChart, IconHistory, IconMore, IconToday } from './icons';

const TABS = [
  { path: '/', label: 'Сегодня', Icon: IconToday },
  { path: '/history', label: 'История', Icon: IconHistory },
  { path: '/progress', label: 'Прогресс', Icon: IconChart },
  { path: '/more', label: 'Ещё', Icon: IconMore },
];

export function Nav({ path }: { path: string }) {
  return (
    <nav class="nav">
      {TABS.map(({ path: p, label, Icon }) => (
        <a href={`#${p}`} class={path === p ? 'active' : ''} aria-current={path === p ? 'page' : undefined}>
          <Icon />
          {label}
        </a>
      ))}
    </nav>
  );
}
