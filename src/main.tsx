import { render } from 'preact';
import { App } from './app';
import './styles.css';

// Просим браузер не стирать базу при нехватке места (особенно важно для Safari).
navigator.storage?.persist?.().catch(() => {});

render(<App />, document.getElementById('app')!);
