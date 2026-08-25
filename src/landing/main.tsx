import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import Landing from './Landing';
import '../ui/tokens.css';
import './landing.css';

const rootElement = document.getElementById('root');

if (!rootElement) throw new Error('OpenFilm could not find its landing-page root element.');

createRoot(rootElement).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
