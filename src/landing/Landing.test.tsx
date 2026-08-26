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
    expect(screen.getAllByText('Desktop workstation')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: /browser requirements/i })).toHaveLength(2);
    expect(
      screen.getByText(/no account system, application backend, analytics/i),
    ).toBeInTheDocument();
    expect(screen.getByText('.openfilm/library.json')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'One folder in. A finished set out.' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.landing-film-strip')).toBeInTheDocument();
    expect(container.querySelector('.proof-frame--crop')).toBeInTheDocument();
    expect(screen.getByLabelText('Workstation keyboard shortcuts')).toHaveTextContent(
      'P PickX Reject0–5 RateSpace SelectEnter LoupeC Compare',
    );
    expect(
      screen.getByText(/actions menu, or keep both hands on the keyboard/),
    ).toBeInTheDocument();
  });
});
