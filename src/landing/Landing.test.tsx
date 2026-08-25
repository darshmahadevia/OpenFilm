import { render, screen } from '@testing-library/react';

import Landing from './Landing';

describe('OpenFilm download landing page', () => {
  it('presents the desktop download and the local-first boundary', () => {
    render(<Landing />);

    expect(
      screen.getByRole('heading', {
        name: 'Review the whole shoot. Keep every photograph local.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /download/i })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('OpenFilm.dmg'),
    );
    expect(
      screen.getByText(/no account system, application backend, analytics/i),
    ).toBeInTheDocument();
    expect(screen.getByText('.openfilm/library.json')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming soon.' })).toBeInTheDocument();
  });
});
