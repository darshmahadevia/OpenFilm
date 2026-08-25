import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DesktopUpdateNotice, type DesktopUpdateState } from './DesktopUpdateNotice';

function installBridge(initial: DesktopUpdateState) {
  let listener: ((state: DesktopUpdateState) => void) | undefined;
  const bridge = {
    check: vi.fn(async () => initial),
    download: vi.fn(async () => initial),
    getState: vi.fn(async () => initial),
    launch: vi.fn(async () => true),
    subscribe: vi.fn((callback: (state: DesktopUpdateState) => void) => {
      listener = callback;
      return vi.fn();
    }),
  };
  window.openFilmUpdates = bridge;
  return { bridge, publish: (state: DesktopUpdateState) => listener?.(state) };
}

const available: DesktopUpdateState = {
  currentVersion: '0.2.0',
  phase: 'available',
  platform: 'mac',
  version: '0.3.0',
};

afterEach(() => {
  delete window.openFilmUpdates;
});

describe('desktop update notice', () => {
  it('shows the update and downloads only after the user clicks', async () => {
    const { bridge } = installBridge(available);
    render(<DesktopUpdateNotice />);

    expect(await screen.findByText('OpenFilm 0.3.0 is available')).toBeVisible();
    expect(bridge.download).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Download update' }));
    expect(bridge.download).toHaveBeenCalledOnce();
  });

  it('shows progress while the installer downloads', async () => {
    const { publish } = installBridge(available);
    render(<DesktopUpdateNotice />);
    await screen.findByText('OpenFilm 0.3.0 is available');

    publish({ ...available, percent: 48, phase: 'downloading' });
    expect(
      await screen.findByRole('progressbar', { name: 'Update download progress' }),
    ).toHaveValue(48);
    expect(screen.getByText('48% downloaded. You can keep working.')).toBeVisible();
  });

  it.each([
    ['mac', 'Open .dmg'],
    ['windows', 'Launch installer'],
  ] as const)('opens the downloaded %s installer', async (platform, action) => {
    const { bridge } = installBridge({ ...available, phase: 'ready', platform });
    render(<DesktopUpdateNotice />);

    fireEvent.click(await screen.findByRole('button', { name: action }));
    expect(bridge.launch).toHaveBeenCalledOnce();
  });

  it('offers the right retry for a failed download', async () => {
    const { bridge } = installBridge({
      ...available,
      errorContext: 'download',
      message: 'OpenFilm could not download the installer. Check your connection and try again.',
      phase: 'error',
    });
    render(<DesktopUpdateNotice />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry download' }));
    expect(bridge.download).toHaveBeenCalledOnce();
  });

  it('moves focus to the status when an action changes its controls', async () => {
    const { bridge, publish } = installBridge(available);
    bridge.download.mockImplementation(async () => {
      const downloading = { ...available, percent: 1, phase: 'downloading' as const };
      publish(downloading);
      return downloading;
    });
    render(<DesktopUpdateNotice />);

    fireEvent.click(await screen.findByRole('button', { name: 'Download update' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: /Downloading/ })).toHaveFocus());
  });

  it('restores focus after dismissing the notice', async () => {
    const { bridge, publish } = installBridge({ ...available, phase: 'idle' });
    render(
      <>
        <button type="button">Library action</button>
        <DesktopUpdateNotice />
      </>,
    );
    await waitFor(() => expect(bridge.getState).toHaveBeenCalledOnce());
    const libraryAction = screen.getByRole('button', { name: 'Library action' });
    libraryAction.focus();
    act(() => publish(available));

    fireEvent.click(await screen.findByRole('button', { name: 'Later' }));
    await waitFor(() => expect(libraryAction).toHaveFocus());
  });

  it('keeps check retries quiet until a newer release is verified', async () => {
    installBridge({
      ...available,
      errorContext: 'check',
      message: 'OpenFilm could not check GitHub Releases. Check your connection and try again.',
      phase: 'error',
      version: undefined,
    });
    render(<DesktopUpdateNotice />);

    const retry = await screen.findByRole('button', { name: 'Check again' });
    expect(retry).toHaveClass('button--outline');
    expect(retry).not.toHaveClass('desktop-update__button');
  });
});
