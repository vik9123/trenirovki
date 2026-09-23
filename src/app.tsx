import { useRoute } from './router';
import { Nav } from './ui/Nav';
import { Today } from './screens/Today';
import { Workout } from './screens/Workout';
import { History } from './screens/History';
import { Progress } from './screens/Progress';
import { More } from './screens/More';

export function App() {
  const path = useRoute();
  const workout = path.match(/^\/w\/(\d+)$/);
  if (workout) return <Workout id={Number(workout[1])} key={workout[1]} />;

  const screen =
    path === '/history' ? <History /> : path === '/progress' ? <Progress /> : path === '/more' ? <More /> : <Today />;
  return (
    <>
      {screen}
      <Nav path={['/history', '/progress', '/more'].includes(path) ? path : '/'} />
    </>
  );
}
