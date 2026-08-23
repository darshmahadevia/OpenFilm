import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './ui/tokens.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('OpenFilm could not find its root element.');
}

const applicationRoot = rootElement;

async function renderApplication() {
  const isDesignPrototype = import.meta.env.DEV && window.location.pathname === '/prototype/design';

  if (isDesignPrototype) {
    const { default: OpenFilmDesignPrototype } =
      await import('./prototype/OpenFilmDesignPrototype');

    createRoot(applicationRoot).render(
      <StrictMode>
        <OpenFilmDesignPrototype />
      </StrictMode>,
    );
    return;
  }

  const [{ default: App }] = await Promise.all([import('./App'), import('./app.css')]);

  createRoot(applicationRoot).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void renderApplication();
