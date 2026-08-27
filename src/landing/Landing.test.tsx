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
    expect(screen.getAllByRole('link', { name: 'Open the workstation' })).toHaveLength(3);
    for (const link of screen.getAllByRole('link', { name: 'Open the workstation' })) {
      expect(link).toHaveAttribute('href', '/app.html');
    }
    expect(screen.getAllByText('Desktop workstation')).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /browser requirements/i })).toHaveLength(1);
    expect(screen.getByText(/no account or upload path/i)).toBeInTheDocument();
    expect(screen.getAllByText('.openfilm/library.json')).not.toHaveLength(0);
    expect(container.querySelector('.landing-film-strip')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.proof-frame')).toHaveLength(1);
    expect(container.querySelector('.landing-review-controls')).not.toBeInTheDocument();
  });
});
