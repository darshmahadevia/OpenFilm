import { Button } from '../ui/components';
import type {
  LibraryWorkspaceSnapshot,
  RecentLibraryEntry,
  RecentLibraryStatus,
} from './libraryApplication';

interface LibraryStartWorkspaceProps {
  canResumeEdit: boolean;
  feedback: string | null;
  importFeedback: { kind: 'error' | 'success'; message: string } | null;
  isLoading: boolean;
  isOpening: boolean;
  isPhotoImporting: boolean;
  onChoosePhoto: () => void;
  onContinueWithoutStorage: () => void;
  onOpenFolder: () => void;
  onOpenRecent: (libraryId: string) => void;
  onReauthorizeRecent: (libraryId: string) => void;
  onResumeEdit: () => void;
  onRetryStorage: () => void;
  onTrySample: () => void;
  recentLibraries: RecentLibraryEntry[];
  recoveryFeedback: string | null;
  recoveryNeedsSource: boolean;
  storageFeedback: string | null;
  storageStatus: 'available' | 'checking' | 'failed' | 'unavailable';
}

interface LibraryWorkspaceProps {
  feedback: string | null;
  onClose: () => void;
  onReauthorize: () => void;
  onRevert: () => void;
  onRetry: () => void;
  onSaveCopy: () => void;
  snapshot: LibraryWorkspaceSnapshot;
}

const recentStatusCopy: Record<RecentLibraryStatus, { description: string; label: string }> = {
  'missing-folder': {
    description: 'The folder or its Library file is no longer available.',
    label: 'Missing folder',
  },
  reauthorize: {
    description: 'Permission has expired. Choose it again to continue.',
    label: 'Reauthorize',
  },
  'read-only': {
    description: 'OpenFilm can read the record, but cannot save to this folder.',
    label: 'Read-only',
  },
  ready: {
    description: 'The saved Library file is available.',
    label: 'Ready',
  },
  'unsaved-recovery': {
    description: 'A working copy is waiting in browser storage.',
    label: 'Unsaved recovery',
  },
};

function RecentLibraryRow({
  entry,
  onOpenRecent,
  onReauthorizeRecent,
}: {
  entry: RecentLibraryEntry;
  onOpenRecent: (libraryId: string) => void;
  onReauthorizeRecent: (libraryId: string) => void;
}) {
  const copy = recentStatusCopy[entry.status];

  return (
    <li className="library-recent__row">
      <div className="library-recent__identity">
        <strong>{entry.rootName}</strong>
        <span>{copy.description}</span>
      </div>
      <span className={`library-status library-status--${entry.status}`}>{copy.label}</span>
      <div className="library-recent__action">
        {entry.status === 'reauthorize' ? (
          <Button onClick={() => onReauthorizeRecent(entry.libraryId)} size="small" variant="quiet">
            Reauthorize
          </Button>
        ) : entry.status === 'missing-folder' ? null : (
          <Button onClick={() => onOpenRecent(entry.libraryId)} size="small" variant="quiet">
            Open Library
          </Button>
        )}
      </div>
    </li>
  );
}

export function LibraryStartWorkspace({
  canResumeEdit,
  feedback,
  importFeedback,
  isLoading,
  isOpening,
  isPhotoImporting,
  onChoosePhoto,
  onContinueWithoutStorage,
  onOpenFolder,
  onOpenRecent,
  onReauthorizeRecent,
  onResumeEdit,
  onRetryStorage,
  onTrySample,
  recentLibraries,
  recoveryFeedback,
  recoveryNeedsSource,
  storageFeedback,
  storageStatus,
}: LibraryStartWorkspaceProps) {
  return (
    <main aria-busy={isLoading || isOpening} className="library-start">
      <header className="library-start__topbar">
        <span className="library-start__brand">OpenFilm</span>
        <span>Local Library workspace</span>
      </header>

      <div className="library-start__body">
        <section aria-labelledby="library-start-title" className="library-start__intro">
          <h1 id="library-start-title">Open a Library.</h1>
          <p>
            Choose one shoot folder. OpenFilm keeps Source photographs in place and saves Library
            state beside them.
          </p>
          <Button disabled={isLoading || isOpening} onClick={onOpenFolder} variant="primary">
            {isOpening ? 'Saving Library…' : 'Open folder'}
          </Button>
          <p className="library-start__format-note">
            The first scan supports JPEG, PNG, and WebP. Nothing is uploaded or copied.
          </p>
          {isOpening ? (
            <span
              aria-label="Library save state: Saving"
              className="library-save-state library-save-state--saving"
              role="status"
            >
              Saving
            </span>
          ) : null}
        </section>

        <section aria-labelledby="recent-libraries-title" className="library-recent">
          <div className="library-section-heading">
            <h2 id="recent-libraries-title">Recent Libraries</h2>
            <span>{recentLibraries.length}</span>
          </div>
          {isLoading ? (
            <p className="library-recent__empty">Checking recent Libraries…</p>
          ) : recentLibraries.length === 0 ? (
            <p className="library-recent__empty">
              No recent Libraries. Open a folder to create the first Library file.
            </p>
          ) : (
            <ul className="library-recent__list">
              {recentLibraries.map((entry) => (
                <RecentLibraryRow
                  entry={entry}
                  key={entry.libraryId}
                  onOpenRecent={onOpenRecent}
                  onReauthorizeRecent={onReauthorizeRecent}
                />
              ))}
            </ul>
          )}
        </section>

        {canResumeEdit || recoveryNeedsSource ? (
          <section aria-labelledby="edit-recovery-title" className="library-start__recovery">
            <h2 id="edit-recovery-title">Recoverable Edit</h2>
            <p>{recoveryFeedback ?? 'A previous Edit is ready in this browser.'}</p>
            {recoveryNeedsSource ? (
              <Button onClick={onChoosePhoto} size="small" variant="outline">
                Choose source photograph
              </Button>
            ) : (
              <Button onClick={onResumeEdit} size="small" variant="outline">
                Resume latest Edit
              </Button>
            )}
          </section>
        ) : null}

        {feedback || storageFeedback ? (
          <div aria-live="polite" className="library-start__feedback" role="status">
            <p>{feedback ?? storageFeedback}</p>
            {storageFeedback ? (
              <Button
                onClick={storageStatus === 'failed' ? onRetryStorage : onContinueWithoutStorage}
                size="small"
                variant="quiet"
              >
                {storageStatus === 'failed' ? 'Try recovery again' : 'Continue without recovery'}
              </Button>
            ) : null}
          </div>
        ) : null}

        {importFeedback?.kind === 'error' ? (
          <div
            aria-live="assertive"
            className="library-start__feedback library-start__feedback--error"
            role="alert"
          >
            <p>
              <strong>That file could not be opened.</strong> {importFeedback.message}
            </p>
            <Button onClick={onChoosePhoto} size="small" variant="quiet">
              Try another file
            </Button>
          </div>
        ) : null}

        <details className="library-start__single-photo" open>
          <summary>Open one photograph instead</summary>
          <p>Keep the existing single-photo editor path for a quick edit without a Library.</p>
          <div className="library-start__single-photo-actions">
            <Button
              disabled={isPhotoImporting}
              onClick={onChoosePhoto}
              size="small"
              variant="outline"
            >
              {isPhotoImporting ? 'Opening photograph…' : 'Choose a photo'}
            </Button>
            <Button disabled={isPhotoImporting} onClick={onTrySample} size="small" variant="quiet">
              Open sample
            </Button>
          </div>
        </details>
      </div>
    </main>
  );
}

function workspaceStatusLabel(status: LibraryWorkspaceSnapshot['status']): string {
  if (status === 'read-only') {
    return 'Read-only';
  }

  if (status === 'saving') {
    return 'Saving';
  }

  if (status === 'unsaved') {
    return 'Unsaved';
  }

  return 'Saved';
}

export function LibraryWorkspace({
  feedback,
  onClose,
  onReauthorize,
  onRevert,
  onRetry,
  onSaveCopy,
  snapshot,
}: LibraryWorkspaceProps) {
  const statusLabel = workspaceStatusLabel(snapshot.status);

  return (
    <main aria-labelledby="library-workspace-title" className="library-workspace">
      <header className="library-workspace__topbar">
        <div>
          <span className="library-start__brand">OpenFilm</span>
          <span className="library-workspace__file">{snapshot.rootName}</span>
        </div>
        <div className="library-workspace__topbar-actions">
          <span
            aria-label={`Library save state: ${statusLabel}`}
            className={`library-save-state library-save-state--${snapshot.status}`}
          >
            {statusLabel}
          </span>
          <Button onClick={onClose} size="small" variant="quiet">
            Recent Libraries
          </Button>
        </div>
      </header>

      <div className="library-workspace__body">
        <section className="library-workspace__empty" aria-labelledby="library-workspace-title">
          <p className="library-workspace__path">Library file · .openfilm/library.json</p>
          <h1 id="library-workspace-title">{snapshot.rootName}</h1>
          <p className="library-workspace__message" role="status">
            {snapshot.message}
          </p>
          {feedback ? (
            <p aria-live="polite" className="library-workspace__feedback" role="status">
              {feedback}
            </p>
          ) : null}
          <div className="library-workspace__facts" aria-label="Library details">
            <div>
              <span>Photograph records</span>
              <strong>{snapshot.library?.photographs.length ?? 'Unavailable'}</strong>
            </div>
            <div>
              <span>Durable revision</span>
              <strong>{snapshot.revision?.revision ?? 'Unavailable'}</strong>
            </div>
          </div>
          {snapshot.library?.photographs.length === 0 ? (
            <p className="library-workspace__empty-copy">
              This Library is empty. Source photographs remain in the selected folder until a
              refresh adds Photograph records.
            </p>
          ) : null}
        </section>

        {snapshot.status === 'unsaved' ? (
          <section aria-labelledby="library-recovery-title" className="library-workspace__recovery">
            <h2 id="library-recovery-title">Resolve Unsaved state</h2>
            <p>OpenFilm will wait for one of these actions before accepting another change.</p>
            <div className="library-workspace__actions">
              <Button onClick={onRetry} variant="primary">
                Retry save
              </Button>
              <Button onClick={onSaveCopy} variant="outline">
                Save a copy
              </Button>
              <Button onClick={onRevert} variant="quiet">
                Revert
              </Button>
            </div>
          </section>
        ) : snapshot.status === 'read-only' ? (
          <section
            aria-labelledby="library-read-only-title"
            className="library-workspace__recovery"
          >
            <h2 id="library-read-only-title">Read-only Library</h2>
            <p>
              OpenFilm will not change this folder until its permission or file conflict is
              resolved.
            </p>
            <div className="library-workspace__actions">
              <Button onClick={onReauthorize} variant="primary">
                Reauthorize folder
              </Button>
              <Button onClick={onClose} variant="quiet">
                Return to recent Libraries
              </Button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
