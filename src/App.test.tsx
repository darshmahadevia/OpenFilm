import { render, screen, waitFor } from '@testing-library/react';

import App from './App';

describe('OpenFilm workstation entry', () => {
  it('starts at the local Library workspace with no legacy editor or marketing path', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Open a Library' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open folder' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent Libraries' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Library backup' })).toBeInTheDocument();
    expect(screen.getByText(/Browser Library state stays in this browser/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sample/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /choose a photo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no account or upload/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Recent Libraries will appear here/)).toBeInTheDocument(),
    );
  });
});
