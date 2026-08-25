import { useEffect, useRef, useState } from 'react';

import { Button } from '../ui/components';

export type DesktopUpdateState = {
  currentVersion: string;
  errorContext?: 'check' | 'download' | 'launch';
  message?: string;
  percent?: number;
  phase:
    'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'opened' | 'up-to-date' | 'error';
  platform: 'mac' | 'windows' | 'unsupported';
  version?: string;
};

type DesktopUpdateBridge = {
  check: () => Promise<DesktopUpdateState>;
  download: () => Promise<DesktopUpdateState>;
  getState: () => Promise<DesktopUpdateState>;
  launch: () => Promise<boolean>;
  subscribe: (callback: (state: DesktopUpdateState) => void) => () => void;
};

declare global {
  interface Window {
    openFilmUpdates?: DesktopUpdateBridge;
  }
}

function noticeCopy(state: DesktopUpdateState) {
  const version = state.version ? ` ${state.version}` : '';
  if (state.phase === 'available') {
    return {
      body: 'Download the installer now, or keep working and update later.',
      title: `OpenFilm${version} is available`,
    };
  }
  if (state.phase === 'downloading') {
    return {
      body: `${Math.round(state.percent ?? 0)}% downloaded. You can keep working.`,
      title: `Downloading OpenFilm${version}`,
    };
  }
  if (state.phase === 'ready') {
    return {
      body:
        state.platform === 'mac'
          ? 'Open the disk image, then drag OpenFilm to Applications.'
          : 'Launch the installer to replace this version of OpenFilm.',
      title: `OpenFilm${version} is downloaded`,
    };
  }
  if (state.phase === 'opened') {
    return {
      body:
        state.platform === 'mac'
          ? 'The disk image is open. Drag OpenFilm to Applications when you are ready.'
          : 'The installer is open. Follow its steps to finish the update.',
      title: 'Installer opened',
    };
  }
  return {
    body: state.message ?? 'OpenFilm could not finish the update.',
    title: 'Update paused',
  };
}

export function DesktopUpdateNotice() {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const focusTitleOnChange = useRef(false);
  const notice = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const updates = window.openFilmUpdates;
    if (!updates) return;
    let mounted = true;
    const unsubscribe = updates.subscribe((next) => {
      if (mounted) setState(next);
    });
    void updates.getState().then((next) => {
      if (mounted) setState(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const visible =
    Boolean(state) &&
    ['available', 'downloading', 'ready', 'opened', 'error'].includes(state!.phase) &&
    !(
      dismissedVersion === state!.version &&
      (state!.phase === 'available' || state!.phase === 'opened')
    );

  useEffect(() => {
    if (!visible || returnFocus.current) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !notice.current?.contains(active)) {
      returnFocus.current = active;
    }
  }, [visible]);

  useEffect(() => {
    if (!focusTitleOnChange.current) return;
    focusTitleOnChange.current = false;
    if (visible) {
      title.current?.focus();
      return;
    }
    const previousFocus = returnFocus.current;
    globalThis.requestAnimationFrame(() => {
      if (previousFocus?.isConnected) previousFocus.focus();
      returnFocus.current = null;
    });
  }, [state?.phase, visible]);

  if (!state || !visible) return null;

  function runAction(action: () => Promise<unknown>) {
    focusTitleOnChange.current = true;
    void action();
  }

  function dismiss() {
    const previousFocus = returnFocus.current;
    setDismissedVersion(state?.version ?? 'latest');
    globalThis.requestAnimationFrame(() => {
      if (previousFocus?.isConnected) previousFocus.focus();
      returnFocus.current = null;
    });
  }

  const copy = noticeCopy(state);
  const launchLabel = state.platform === 'mac' ? 'Open .dmg' : 'Launch installer';

  return (
    <section
      aria-labelledby="desktop-update-title"
      aria-live="polite"
      className="desktop-update"
      ref={notice}
      role="region"
    >
      <div className="desktop-update__copy">
        <h2 id="desktop-update-title" ref={title} tabIndex={-1}>
          {copy.title}
        </h2>
        <p>{copy.body}</p>
      </div>

      {state.phase === 'downloading' ? (
        <progress
          aria-label="Update download progress"
          aria-valuetext={`${Math.round(state.percent ?? 0)}% downloaded`}
          max="100"
          value={state.percent ?? 0}
        />
      ) : null}

      <div className="desktop-update__actions">
        {state.phase === 'available' ? (
          <Button
            className="desktop-update__button"
            onClick={() => runAction(() => window.openFilmUpdates!.download())}
          >
            Download update
          </Button>
        ) : null}
        {state.phase === 'ready' ? (
          <Button
            className="desktop-update__button"
            onClick={() => runAction(() => window.openFilmUpdates!.launch())}
          >
            {launchLabel}
          </Button>
        ) : null}
        {state.phase === 'opened' ? (
          <Button
            onClick={() => runAction(() => window.openFilmUpdates!.launch())}
            variant="outline"
          >
            Open again
          </Button>
        ) : null}
        {state.phase === 'error' && state.errorContext === 'check' ? (
          <Button
            onClick={() => runAction(() => window.openFilmUpdates!.check())}
            variant="outline"
          >
            Check again
          </Button>
        ) : null}
        {state.phase === 'error' && state.errorContext === 'download' ? (
          <Button
            className="desktop-update__button"
            onClick={() => runAction(() => window.openFilmUpdates!.download())}
          >
            Retry download
          </Button>
        ) : null}
        {state.phase === 'error' && state.errorContext === 'launch' ? (
          <Button
            className="desktop-update__button"
            onClick={() => runAction(() => window.openFilmUpdates!.launch())}
          >
            {launchLabel}
          </Button>
        ) : null}
        {state.phase === 'available' || state.phase === 'opened' ? (
          <Button onClick={dismiss} variant="quiet">
            {state.phase === 'opened' ? 'Done' : 'Later'}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
