import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { Select } from '../ui/components';
import { LIBRARY_GRID_THUMBNAIL_MAX_WIDTH, type LibraryThumbnail } from './libraryThumbnail';
import type { LibraryGridDensity } from './libraryGridModel';
import type { LibraryPhotographRecord } from './libraryModel';
import type { ReviewCommand } from './libraryReview';

const GRID_DENSITY_SETTINGS: Record<LibraryGridDensity, { minimumCellWidth: number }> = {
  detail: { minimumCellWidth: 320 },
  overview: { minimumCellWidth: 176 },
  standard: { minimumCellWidth: 240 },
};

interface GridGeometry {
  cellHeight: number;
  columns: number;
  viewportHeight: number;
}

interface LibraryGridProps {
  activePhotographId: string | null;
  density: LibraryGridDensity;
  initialScrollTop?: number;
  canReview: boolean;
  onActivate: (photographId: string) => void;
  onLoadThumbnail: (
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
    cacheRevision?: string,
  ) => Promise<LibraryThumbnail>;
  onScrollTopChange?: (scrollTop: number) => void;
  onOpenLoupe: (photographId: string) => void;
  onReview: (photographId: string, command: ReviewCommand) => void;
  onToggleSelection: (photographId: string) => void;
  photographs: readonly LibraryPhotographRecord[];
  selectedPhotographIds: ReadonlySet<string>;
  scrollRestoreRevision?: number;
}

function calculateGridGeometry(width: number, viewportHeight: number, density: LibraryGridDensity) {
  const minimumCellWidth = GRID_DENSITY_SETTINGS[density].minimumCellWidth;
  const gap = 1;
  const usableWidth = Math.max(width, minimumCellWidth);
  const columns = Math.max(1, Math.floor((usableWidth + gap) / (minimumCellWidth + gap)));
  const cellWidth = (usableWidth - gap * (columns - 1)) / columns;
  const imageHeight = Math.max(112, Math.round(cellWidth * 0.7));

  return {
    cellHeight: imageHeight + 48,
    columns,
    viewportHeight: Math.max(viewportHeight, 240),
  } satisfies GridGeometry;
}

function photographLabel(
  photograph: LibraryPhotographRecord,
  isActive: boolean,
  isSelected: boolean,
): string {
  const state =
    photograph.sourceState === 'missing' ? 'Missing photograph' : 'Source photograph available';
  const active = isActive ? ' Active photograph.' : '';
  const selected = isSelected ? ' Selected.' : '';
  const rating =
    photograph.rating === null ? ' Unrated.' : ` Rated ${photograph.rating} of 5 stars.`;
  const disposition = ` Disposition ${photograph.disposition}.`;

  return `${photograph.relativePath}. ${state}.${active}${selected}${rating}${disposition} Press Space to toggle Selection.`;
}

function dispositionLabel(photograph: LibraryPhotographRecord): string {
  if (photograph.sourceState === 'missing') {
    return 'Missing photograph';
  }

  if (photograph.disposition === 'pick') {
    return 'Pick';
  }

  if (photograph.disposition === 'reject') {
    return 'Reject';
  }

  return 'Unmarked';
}

function GridPhotographCell({
  isActive,
  isSelected,
  canReview,
  onActivate,
  onLoadThumbnail,
  onOpenLoupe,
  onReview,
  onToggleSelection,
  photograph,
}: {
  isActive: boolean;
  isSelected: boolean;
  canReview: boolean;
  onActivate: (photographId: string) => void;
  onLoadThumbnail: (
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
    cacheRevision?: string,
  ) => Promise<LibraryThumbnail>;
  onOpenLoupe: (photographId: string) => void;
  onReview: (photographId: string, command: ReviewCommand) => void;
  onToggleSelection: (photographId: string) => void;
  photograph: LibraryPhotographRecord;
}) {
  const [thumbnail, setThumbnail] = useState<LibraryThumbnail | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const thumbnailRef = useRef<LibraryThumbnail | null>(null);
  const actionsRef = useRef<HTMLDetailsElement>(null);
  const isMissing = photograph.sourceState === 'missing';

  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();

    if (isMissing) {
      return () => {
        disposed = true;
        controller.abort();
      };
    }

    void onLoadThumbnail(
      photograph.relativePath,
      LIBRARY_GRID_THUMBNAIL_MAX_WIDTH,
      controller.signal,
      `${photograph.fingerprint.byteSize}:${photograph.fingerprint.lastModified}`,
    )
      .then((nextThumbnail) => {
        if (disposed) {
          nextThumbnail.dispose();
          return;
        }

        thumbnailRef.current = nextThumbnail;
        setThumbnail(nextThumbnail);
        setImageReady(false);
      })
      .catch(() => {
        if (!disposed) {
          setImageError(true);
        }
      });

    return () => {
      disposed = true;
      controller.abort();
      thumbnailRef.current?.dispose();
      thumbnailRef.current = null;
    };
  }, [
    isMissing,
    onLoadThumbnail,
    photograph.fingerprint.byteSize,
    photograph.fingerprint.lastModified,
    photograph.relativePath,
  ]);

  return (
    <div
      className={`library-grid__cell ${isActive ? 'library-grid__cell--active' : ''} ${isSelected ? 'library-grid__cell--selected' : ''} ${isMissing ? 'library-grid__cell--missing' : ''}`}
      role="gridcell"
    >
      <button
        aria-current={isActive ? 'true' : undefined}
        aria-label={photographLabel(photograph, isActive, isSelected)}
        aria-pressed={isSelected}
        className="library-grid__photograph"
        data-photograph-id={photograph.id}
        onClick={() => onActivate(photograph.id)}
        onKeyDown={(event) => {
          if (event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onToggleSelection(photograph.id);
          }
        }}
        type="button"
      >
        <span className="library-grid__image-frame">
          {thumbnail && !imageError ? (
            <>
              <img
                alt=""
                className="library-grid__image"
                decoding="async"
                draggable="false"
                loading="lazy"
                onError={() => setImageError(true)}
                onLoad={() => setImageReady(true)}
                src={thumbnail.url}
              />
              {!imageReady ? (
                <span className="library-grid__placeholder">Reading Source photograph</span>
              ) : null}
            </>
          ) : (
            <span className="library-grid__placeholder">
              {isMissing
                ? 'Missing photograph'
                : imageError
                  ? 'Preview unavailable'
                  : 'Reading Source photograph'}
            </span>
          )}
        </span>
        <span className="library-grid__metadata">
          <span className="library-grid__filename" title={photograph.relativePath}>
            {photograph.fileName}
          </span>
          <span className="library-grid__state">
            <span>{dispositionLabel(photograph)}</span>
            <span>{photograph.rating === null ? 'Unrated' : `${photograph.rating}/5`}</span>
            {isActive ? <span className="library-grid__state-badge">Active</span> : null}
            {isSelected ? <span className="library-grid__state-badge">Selected</span> : null}
          </span>
        </span>
      </button>
      <details className="library-grid__actions" data-workstation-popover="true" ref={actionsRef}>
        <summary aria-label={`Photo actions for ${photograph.fileName}`}>
          <span aria-hidden="true" />
        </summary>
        <div aria-label={`Review actions for ${photograph.fileName}`}>
          <button
            aria-pressed={isSelected}
            onClick={(event) => {
              onToggleSelection(photograph.id);
              event.currentTarget.closest('details')?.removeAttribute('open');
            }}
            type="button"
          >
            {isSelected ? 'Remove from Selection' : 'Add to Selection'}
            <kbd aria-hidden="true">Space</kbd>
          </button>
          <button
            onClick={(event) => {
              onOpenLoupe(photograph.id);
              event.currentTarget.closest('details')?.removeAttribute('open');
            }}
            type="button"
          >
            Open in Loupe
            <kbd aria-hidden="true">Enter</kbd>
          </button>
          <span className="library-grid__actions-label">Review</span>
          {(['pick', 'reject', 'unmarked'] as const).map((disposition) => (
            <button
              aria-pressed={photograph.disposition === disposition}
              disabled={!canReview}
              key={disposition}
              onClick={(event) => {
                onReview(photograph.id, { kind: 'set-disposition', disposition });
                event.currentTarget.closest('details')?.removeAttribute('open');
              }}
              type="button"
            >
              {disposition === 'pick'
                ? 'Mark as Pick'
                : disposition === 'reject'
                  ? 'Mark as Reject'
                  : 'Clear review mark'}
              <kbd aria-hidden="true">
                {disposition === 'pick' ? 'P' : disposition === 'reject' ? 'X' : 'U'}
              </kbd>
            </button>
          ))}
          <div className="library-grid__rating-field">
            <span>Rating</span>
            <Select
              align="end"
              disabled={!canReview}
              label={`Rating for ${photograph.fileName}`}
              onValueChange={(value) => {
                onReview(photograph.id, {
                  kind: 'rate',
                  rating: value ? Number(value) : null,
                });
                actionsRef.current?.removeAttribute('open');
                actionsRef.current?.querySelector('summary')?.focus();
              }}
              options={[
                { label: 'Unrated', value: '' },
                ...[1, 2, 3, 4, 5].map((rating) => ({
                  label: `${rating} star${rating === 1 ? '' : 's'}`,
                  value: String(rating),
                })),
              ]}
              restoreFocusOnSelect={false}
              value={String(photograph.rating ?? '')}
            />
          </div>
        </div>
      </details>
    </div>
  );
}

export function LibraryGrid({
  activePhotographId,
  canReview,
  density,
  initialScrollTop = 0,
  onActivate,
  onLoadThumbnail,
  onOpenLoupe,
  onReview,
  onScrollTopChange,
  onToggleSelection,
  photographs,
  selectedPhotographIds,
  scrollRestoreRevision = 0,
}: LibraryGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const initialScrollTopRef = useRef(initialScrollTop);
  const focusedPhotographIdRef = useRef(activePhotographId);
  const [geometry, setGeometry] = useState<GridGeometry>(() =>
    calculateGridGeometry(0, 0, density),
  );
  const [scrollTop, setScrollTop] = useState(initialScrollTop);
  const activeIndex = photographs.findIndex((photograph) => photograph.id === activePhotographId);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const measure = () => {
      setGeometry(calculateGridGeometry(viewport.clientWidth, viewport.clientHeight, density));
    };

    measure();
    viewport.scrollTop = initialScrollTopRef.current;

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [density]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || scrollRestoreRevision === 0) return;
    viewport.scrollTop = initialScrollTop;
    setScrollTop(initialScrollTop);
  }, [initialScrollTop, scrollRestoreRevision]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || activeIndex < 0 || focusedPhotographIdRef.current === activePhotographId) {
      return;
    }
    focusedPhotographIdRef.current = activePhotographId;

    const activeRow = Math.floor(activeIndex / geometry.columns);
    const rowTop = activeRow * geometry.cellHeight;
    const rowBottom = rowTop + geometry.cellHeight;
    if (rowTop < viewport.scrollTop) viewport.scrollTop = rowTop;
    else if (rowBottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = Math.max(0, rowBottom - viewport.clientHeight);
    }

    requestAnimationFrame(() => {
      const activeButton = Array.from(
        viewport.querySelectorAll<HTMLElement>('[data-photograph-id]'),
      ).find((element) => element.dataset.photographId === activePhotographId);
      activeButton?.focus({ preventScroll: true });
    });
  }, [activeIndex, activePhotographId, geometry.cellHeight, geometry.columns]);

  const rowCount = Math.ceil(photographs.length / geometry.columns);
  const firstVisibleRow = Math.max(0, Math.floor(scrollTop / geometry.cellHeight) - 2);
  const lastVisibleRow = Math.min(
    rowCount,
    Math.ceil((scrollTop + geometry.viewportHeight) / geometry.cellHeight) + 2,
  );
  const visibleRows = [];

  for (let row = firstVisibleRow; row < lastVisibleRow; row += 1) {
    const start = row * geometry.columns;
    const rowPhotographs = photographs.slice(start, start + geometry.columns);

    visibleRows.push(
      <div
        aria-rowindex={row + 1}
        className="library-grid__row"
        key={row}
        role="row"
        style={
          {
            height: geometry.cellHeight,
            transform: `translateY(${row * geometry.cellHeight}px)`,
            '--library-grid-columns': geometry.columns,
          } as CSSProperties
        }
      >
        {rowPhotographs.map((photograph) => (
          <GridPhotographCell
            canReview={canReview}
            isActive={photograph.id === activePhotographId}
            isSelected={selectedPhotographIds.has(photograph.id)}
            key={`${photograph.id}-${photograph.fingerprint.byteSize}-${photograph.fingerprint.lastModified}-${photograph.sourceState}`}
            onActivate={onActivate}
            onLoadThumbnail={onLoadThumbnail}
            onOpenLoupe={onOpenLoupe}
            onReview={onReview}
            onToggleSelection={onToggleSelection}
            photograph={photograph}
          />
        ))}
        {rowPhotographs.length < geometry.columns
          ? Array.from({ length: geometry.columns - rowPhotographs.length }, (_, index) => (
              <span
                aria-hidden="true"
                className="library-grid__cell library-grid__cell--empty"
                key={index}
              />
            ))
          : null}
      </div>,
    );
  }

  return (
    <div
      aria-colcount={geometry.columns}
      aria-description={`${photographs.length.toLocaleString()} photograph${photographs.length === 1 ? '' : 's'}`}
      aria-label="Library Grid"
      aria-rowcount={rowCount}
      className="library-grid"
      ref={viewportRef}
      role="grid"
      onScroll={(event) => {
        const { clientHeight, scrollTop: nextScrollTop } = event.currentTarget;
        setScrollTop(nextScrollTop);
        onScrollTopChange?.(nextScrollTop);
        setGeometry((current) => ({
          ...current,
          viewportHeight: Math.max(clientHeight, 240),
        }));
      }}
    >
      {photographs.length === 0 ? (
        <p className="library-grid__empty">
          No supported Source photographs are in this Library yet.
        </p>
      ) : (
        <div className="library-grid__canvas" style={{ height: rowCount * geometry.cellHeight }}>
          {visibleRows}
        </div>
      )}
    </div>
  );
}
