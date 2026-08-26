import { render, screen } from '@testing-library/react';

import { HomePage } from './Landing';

describe('OpenFilm website', () => {
  it('presents the product story and opens the browser workstation', () => {
    const { container } = render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        name: 'Review the whole shoot. Keep every photograph local.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open OpenFilm' })).toHaveLength(3);
    for (const link of screen.getAllByRole('link', { name: 'Open OpenFilm' })) {
      expect(link).toHaveAttribute('href', '/app.html');
    }
    expect(
      screen.getByText(/no account system, application backend, analytics/i),
    ).toBeInTheDocument();
    expect(screen.getByText('.openfilm/library.json')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'One folder in. A finished set out.' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.landing-film-strip')).toBeInTheDocument();
    expect(container.querySelector('.proof-frame--crop')).toBeInTheDocument();
  });
});
