import { render, screen } from '@testing-library/react';

import packageManifest from '../../package.json';
import { DownloadPage, HomePage } from './Landing';
import { detectDesktopPlatform } from './platform';

describe('OpenFilm website', () => {
  it('presents a scroll-led product story with a separate download route', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        name: 'Review the whole shoot. Keep every photograph local.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download OpenFilm' })).toHaveAttribute(
      'href',
      '/download',
    );
    expect(screen.getByText(/contacts GitHub Releases for update checks/i)).toBeInTheDocument();
    expect(screen.getByText('.openfilm/library.json')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'One folder in. A finished set out.' }),
    ).toBeInTheDocument();
  });

  it('offers both stable release assets on the download page', () => {
    render(<DownloadPage />);
    expect(screen.getByRole('group', { name: 'OpenFilm desktop downloads' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download for macOS' })).toHaveAttribute(
      'href',
      'https://github.com/darshmahadevia/OpenFilm/releases/latest/download/OpenFilm.dmg',
    );
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute(
      'href',
      'https://github.com/darshmahadevia/OpenFilm/releases/latest/download/OpenFilm-Setup.exe',
    );
  });

  it('detects desktop operating systems without starting a download', () => {
    expect(detectDesktopPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS');
    expect(detectDesktopPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(detectDesktopPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(
      'unsupported',
    );
    expect(detectDesktopPlatform('Mozilla/5.0 (X11; Linux x86_64)')).toBe('unsupported');
  });

  it('links to the stable asset names produced by the desktop packager', () => {
    expect(packageManifest.build.mac.artifactName.replace('${ext}', 'dmg')).toBe('OpenFilm.dmg');
    expect(packageManifest.build.win.artifactName.replace('${ext}', 'exe')).toBe(
      'OpenFilm-Setup.exe',
    );
  });
});
