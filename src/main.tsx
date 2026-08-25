import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './ui/tokens.css';
import './app.css';

const rootElement = document.getElementById('root');

if (new URLSearchParams(window.location.search).has('desktop')) {
  document.documentElement.dataset.desktopShell = '';
}

if (!rootElement) {
  throw new Error('OpenFilm could not find its root element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
