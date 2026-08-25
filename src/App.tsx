import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from './ui/components';
import { AdaptiveLibraryWorkspace } from './library/AdaptiveLibraryWorkspace';
import {
  LibraryApplication,
  type LibraryActionResult,
  type LibraryOpenResult,
  type LibraryWorkspaceSnapshot,
  type RecentLibraryEntry,
} from './library/libraryApplication';
import { createBrowserLibraryDirectoryGateway } from './library/libraryGateway';
import {
  inspectLegacyState,
  importLegacyLooks,
  resolveLegacyMigration,
  type LegacyMigrationState,
} from './library/libraryMigration';
import type { LibraryThumbnail } from './library/libraryThumbnail';
import { DesktopUpdateNotice } from './updates/DesktopUpdateNotice';
import {
  createBrowserStorage,
  createMemoryStorage,
  hasBrowserStorage,
  type BrowserStorage,
  type StoredLook,
} from './storage/browserStorage';

const MIGRATION_RESOLUTION_KEY = 'openfilm.v2.legacy-resolution';

function readMigrationResolution(): string | null {
  try {
    return localStorage.getItem(MIGRATION_RESOLUTION_KEY);
  } catch {
    return null;
  }
}

function saveMigrationResolution(fingerprint: string): void {
  try {
    localStorage.setItem(MIGRATION_RESOLUTION_KEY, fingerprint);
  } catch {
    /* Keep it resolved for this session. */
  }
}

function downloadJson(value: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function MigrationNotice({
  migration,
  onResolve,
}: {
  migration: LegacyMigrationState;
  onResolve: (action: 'discard' | 'export-edit' | 'import-looks') => void;
}) {
  if (migration.kind !== 'action-required') return null;
  return (
    <section aria-labelledby="migration-title" className="library-start__recovery">
      <h2 id="migration-title">Previous OpenFilm state found</h2>
      <p>
        {migration.looks.length} valid Look{migration.looks.length === 1 ? '' : 's'} can continue in
        v2.{' '}
        {migration.quarantinedEdit
          ? `The recoverable Edit for ${migration.quarantinedEdit.sourceFileName ?? 'a Source photograph'} stays quarantined until you export or discard it.`
          : ''}
      </p>
      {migration.errors.map((error) => (
        <p key={error} role="alert">
          {error}
        </p>
      ))}
      <div className="library-start__migration-actions">
        {migration.looks.length ? (
          <Button onClick={() => onResolve('import-looks')} size="small" variant="primary">
            Keep {migration.looks.length} Looks
          </Button>
        ) : null}
        {migration.quarantinedEdit ? (
          <Button onClick={() => onResolve('export-edit')} size="small" variant="outline">
            Export recovery JSON
          </Button>
        ) : null}
        <Button onClick={() => onResolve('discard')} size="small" variant="quiet">
          Dismiss legacy state
        </Button>
      </div>
    </section>
  );
}

function StartWorkspace({
  feedback,
  isLoading,
  isOpening,
  migration,
  onOpen,
  onOpenRecent,
  onReauthorize,
  onResolveMigration,
  recent,
  storageAvailable,
}: {
  feedback: string | null;
  isLoading: boolean;
  isOpening: boolean;
  migration: LegacyMigrationState | null;
  onOpen: () => void;
  onOpenRecent: (id: string) => void;
  onReauthorize: (id: string) => void;
  onResolveMigration: (action: 'discard' | 'export-edit' | 'import-looks') => void;
  recent: RecentLibraryEntry[];
  storageAvailable: boolean;
}) {
  return (
    <main className="library-start">
      <header className="library-start__topbar">
        <span className="library-start__brand">OpenFilm</span>
        <span>Local photography workstation</span>
      </header>
      <div className="library-start__body">
        <section aria-labelledby="library-start-title" className="library-start__intro">
          <h1 id="library-start-title">Open a Library</h1>
          <p>
            Choose a shoot folder. Your Source photographs stay in place, and OpenFilm saves your
            review beside them.
          </p>
          <div className="library-start__primary-action">
            <Button disabled={isOpening} onClick={onOpen} variant="primary">
              {isOpening ? 'Opening Library…' : 'Open folder'}
            </Button>
            <span>JPEG, PNG, or WebP</span>
          </div>
          <p className="library-start__format-note">
            Library state is stored in <code>.openfilm/library.json</code>. No account or upload.
          </p>
        </section>

        <section aria-labelledby="recent-libraries-title" className="library-recent">
          <div className="library-section-heading">
            <h2 id="recent-libraries-title">Recent Libraries</h2>
            <span>{recent.length}</span>
          </div>
          {isLoading ? (
            <p className="library-recent__empty">Checking recent Libraries…</p>
          ) : recent.length === 0 ? (
            <p className="library-recent__empty">Recent Libraries will appear here.</p>
          ) : (
            <ul className="library-recent__list">
              {recent.map((entry) => (
                <li className="library-recent__row" key={entry.libraryId}>
                  <div className="library-recent__identity">
                    <strong>{entry.rootName}</strong>
                  </div>
                  <span className={`library-status library-status--${entry.status}`}>
                    {entry.status.replaceAll('-', ' ')}
                  </span>
                  <div className="library-recent__action">
                    {entry.status === 'reauthorize' ? (
                      <Button
                        onClick={() => onReauthorize(entry.libraryId)}
                        size="small"
                        variant="quiet"
                      >
                        Reauthorize
                      </Button>
                    ) : entry.status !== 'missing-folder' ? (
                      <Button
                        onClick={() => onOpenRecent(entry.libraryId)}
                        size="small"
                        variant="quiet"
                      >
                        Open Library
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {migration ? (
          <MigrationNotice migration={migration} onResolve={onResolveMigration} />
        ) : null}
        {!storageAvailable ? (
          <p className="library-start__feedback" role="status">
            Browser recovery storage is unavailable. Durable Library files still work while this tab
            remains open.
          </p>
        ) : null}
        {feedback ? (
          <p aria-live="polite" className="library-start__feedback" role="status">
            {feedback}
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default function App() {
  const applicationRef = useRef<LibraryApplication | null>(null);
  const [snapshot, setSnapshot] = useState<LibraryWorkspaceSnapshot | null>(null);
  const [recent, setRecent] = useState<RecentLibraryEntry[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [migration, setMigration] = useState<LegacyMigrationState | null>(null);
  const [historyStatus, setHistoryStatus] = useState({ canRedo: false, canUndo: false });
  const [customLooks, setCustomLooks] = useState<StoredLook[]>([]);
  const storageRef = useRef<BrowserStorage | null>(null);
  const storageAvailable = hasBrowserStorage();

  const refreshRecent = useCallback(async () => {
    const application = applicationRef.current;
    if (!application) return;
    try {
      setRecent(await application.listRecentLibraries());
    } catch {
      setFeedback('OpenFilm could not read recent Libraries.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const gateway = createBrowserLibraryDirectoryGateway();
    const browserStorage = createBrowserStorage();
    const storage = browserStorage ?? createMemoryStorage();
    storageRef.current = storage;
    if (gateway) {
      applicationRef.current = new LibraryApplication(gateway, storage);
      (window as Window & { __openfilmLibraryMetrics?: () => unknown }).__openfilmLibraryMetrics =
        () => applicationRef.current?.resourceStatus() ?? null;
    }
    void (async () => {
      try {
        const [looks, edit] = await Promise.all([
          storage.listCustomLooks(),
          storage.loadLatestEdit(),
        ]);
        if (!cancelled) {
          const inspected = inspectLegacyState(looks, edit, readMigrationResolution());
          setMigration(inspected);
          setCustomLooks(inspected.kind === 'resolved' ? looks : []);
        }
        await refreshRecent();
      } catch {
        if (!cancelled)
          setFeedback('Browser recovery could not start. Durable Library files still work.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      applicationRef.current?.close();
      applicationRef.current = null;
      storageRef.current = null;
      delete (window as Window & { __openfilmLibraryMetrics?: () => unknown })
        .__openfilmLibraryMetrics;
    };
  }, [refreshRecent]);

  function applyOpenResult(result: LibraryOpenResult): void {
    if (result.kind === 'cancelled') return;
    if (result.kind === 'opened' || result.kind === 'read-only') {
      setSnapshot(result.snapshot);
      setFeedback(null);
      setHistoryStatus(
        applicationRef.current?.historyStatus() ?? { canRedo: false, canUndo: false },
      );
      if (
        result.kind === 'opened' &&
        result.created &&
        result.snapshot.status === 'saved' &&
        result.snapshot.scan.status === 'idle'
      ) {
        void applicationRef.current?.scanLibrary(setSnapshot);
      }
      return;
    }
    setFeedback(
      result.kind === 'reauthorize'
        ? result.message
        : `OpenFilm could not find ${result.rootName}.`,
    );
  }

  async function open(action: () => Promise<LibraryOpenResult>): Promise<void> {
    if (opening) return;
    setOpening(true);
    setFeedback(null);
    try {
      applyOpenResult(await action());
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'OpenFilm could not open that Library.');
    } finally {
      setOpening(false);
      await refreshRecent();
    }
  }

  async function applyAction(action: Promise<LibraryActionResult>): Promise<void> {
    try {
      const result = await action;
      if (result.kind === 'updated') setSnapshot(result.snapshot);
      setFeedback(result.kind === 'updated' ? null : result.message);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'OpenFilm could not complete that Library action.',
      );
    }
    setHistoryStatus(applicationRef.current?.historyStatus() ?? { canRedo: false, canUndo: false });
    await refreshRecent();
  }

  const loadThumbnail = useCallback(
    (
      path: string,
      maxWidth: number,
      signal?: AbortSignal,
      cacheRevision?: string,
    ): Promise<LibraryThumbnail> =>
      applicationRef.current?.loadLibraryThumbnail(path, maxWidth, signal, cacheRevision) ??
      Promise.reject(new Error('Open a Library first.')),
    [],
  );
  const loadComparisonThumbnail = useCallback(
    (
      path: string,
      maxWidth: number,
      signal?: AbortSignal,
      cacheRevision?: string,
    ): Promise<LibraryThumbnail> =>
      applicationRef.current?.loadComparisonThumbnail(path, maxWidth, signal, cacheRevision) ??
      Promise.reject(new Error('Open a Library first.')),
    [],
  );
  const loadSource = useCallback(
    (path: string, signal?: AbortSignal): Promise<File> =>
      applicationRef.current?.readSourcePhotograph(path, signal) ??
      Promise.reject(new Error('Open a Library first.')),
    [],
  );

  async function resolveMigration(action: 'discard' | 'export-edit' | 'import-looks') {
    if (!migration || migration.kind !== 'action-required') return;
    const resolution = resolveLegacyMigration(migration, action);
    if (action === 'export-edit' && migration.quarantinedEdit)
      downloadJson(migration.quarantinedEdit, 'openfilm-v1-recovery.json');
    if (action === 'import-looks') {
      if (!storageRef.current) throw new Error('Browser storage is unavailable.');
      setCustomLooks(await importLegacyLooks(migration, storageRef.current));
    }
    saveMigrationResolution(resolution.fingerprint);
    setMigration({ ...migration, kind: 'resolved' });
    setFeedback(
      action === 'import-looks'
        ? `Kept ${migration.looks.length} v1 Looks.`
        : action === 'export-edit'
          ? 'Exported the quarantined v1 Edit as recovery JSON.'
          : 'Dismissed the quarantined v1 state without attaching it to a Library.',
    );
  }

  if (!snapshot) {
    return (
      <>
        <StartWorkspace
          feedback={feedback}
          isLoading={loading}
          isOpening={opening}
          migration={migration}
          onOpen={() => void open(() => applicationRef.current!.openPickedFolder())}
          onOpenRecent={(id) => void open(() => applicationRef.current!.openRecentLibrary(id))}
          onReauthorize={(id) =>
            void open(() => applicationRef.current!.reauthorizeRecentLibrary(id))
          }
          onResolveMigration={(action) => void resolveMigration(action)}
          recent={recent}
          storageAvailable={storageAvailable}
        />
        <DesktopUpdateNotice />
      </>
    );
  }

  const application = applicationRef.current;
  return (
    <>
      <AdaptiveLibraryWorkspace
        customLooks={customLooks}
        feedback={feedback}
        historyStatus={historyStatus}
        key={snapshot.libraryId ?? 'library'}
        onCancelScan={() => application?.cancelScan()}
        onClose={() => {
          application?.close();
          setSnapshot(null);
          setFeedback(null);
          void refreshRecent();
        }}
        onCommit={async (library, message) => {
          if (!application) return false;
          const result = await application.commitCommand(() => library, message);
          await applyAction(Promise.resolve(result));
          return result.kind === 'updated' && result.snapshot.status === 'saved';
        }}
        onLoadSource={loadSource}
        onLoadComparisonThumbnail={loadComparisonThumbnail}
        onLoadThumbnail={loadThumbnail}
        onPickExportDestination={async () => {
          if (!application) throw new Error('Open a Library first.');
          return await application.pickExportDestination();
        }}
        onReauthorize={() => {
          if (snapshot.libraryId && application)
            void open(() => application.reauthorizeRecentLibrary(snapshot.libraryId!));
        }}
        onReauthorizeScan={async () => {
          if (!snapshot.libraryId || !application) return;
          const result = await application.reauthorizeRecentLibrary(snapshot.libraryId);
          applyOpenResult(result);
          if (result.kind === 'opened' && result.snapshot.status === 'saved') {
            await application.scanLibrary(setSnapshot, { cacheContentHashes: true });
          }
          await refreshRecent();
        }}
        onReadExportFile={async (destination, path) => {
          if (!application) throw new Error('Open a Library first.');
          return await application.readExportFile(destination, path);
        }}
        onRenderExport={async (photograph, options, signal) => {
          if (!application) throw new Error('Open a Library first.');
          return await application.renderExportPhotograph(photograph, options, signal);
        }}
        onRedo={async () => {
          if (!application) return false;
          const result = await application.redo();
          await applyAction(Promise.resolve(result));
          return result.kind === 'updated' && result.snapshot.status === 'saved';
        }}
        onRefresh={() => {
          if (application)
            void application
              .scanLibrary(setSnapshot, { cacheContentHashes: true })
              .then(() => refreshRecent());
        }}
        onRevert={() => {
          if (application) void applyAction(application.revert());
        }}
        onRetry={() => {
          if (application) void applyAction(application.retry());
        }}
        onSaveCopy={() => {
          if (application) void applyAction(application.saveCopy());
        }}
        onUndo={async () => {
          if (!application) return false;
          const result = await application.undo();
          await applyAction(Promise.resolve(result));
          return result.kind === 'updated' && result.snapshot.status === 'saved';
        }}
        onWriteExportFile={async (destination, path, bytes, options) => {
          if (!application) throw new Error('Open a Library first.');
          await application.writeExportFile(destination, path, bytes, options);
        }}
        snapshot={snapshot}
      />
      <DesktopUpdateNotice />
    </>
  );
}
