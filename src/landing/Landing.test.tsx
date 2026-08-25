import { render, screen } from '@testing-library/react';

import packageManifest from '../../package.json';
import Landing from './Landing';

describe('OpenFilm download landing page', () => {
  it('presents the desktop download and the local-first boundary', () => {
    render(<Landing />);

    expect(
      screen.getByRole('heading', {
        name: 'Review the whole shoot. Keep every photograph local.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Download for macOS' })[0]).toHaveAttribute(
      'href',
      'https://github.com/darshmahadevia/OpenFilm/releases/latest/download/OpenFilm.dmg',
    );
    expect(screen.getAllByRole('link', { name: 'Download for Windows' })[0]).toHaveAttribute(
      'href',
      'https://github.com/darshmahadevia/OpenFilm/releases/latest/download/OpenFilm-Setup.exe',
    );
    expect(
      screen.getByText(/no account system, application backend, analytics/i),
    ).toBeInTheDocument();
    expect(screen.getByText('.openfilm/library.json')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming soon.' })).toBeInTheDocument();
  });

  it('links to the stable asset names produced by the desktop packager', () => {
    expect(packageManifest.build.mac.artifactName.replace('${ext}', 'dmg')).toBe('OpenFilm.dmg');
    expect(packageManifest.build.win.artifactName.replace('${ext}', 'exe')).toBe(
      'OpenFilm-Setup.exe',
    );
  });
});
