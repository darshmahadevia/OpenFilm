import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { LIBRARY_GRID_THUMBNAIL_MAX_WIDTH, type LibraryThumbnail } from './libraryThumbnail';
import type { LibraryGridDensity } from './libraryGridModel';
import type { LibraryPhotographRecord } from './libraryModel';

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
  onActivate: (photographId: string) => void;
  onLoadThumbnail: (
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
  ) => Promise<LibraryThumbnail>;
  onToggleSelection: (photographId: string) => void;
  photographs: readonly LibraryPhotographRecord[];
  selectedPhotographIds: ReadonlySet<string>;
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
  onActivate,
  onLoadThumbnail,
  onToggleSelection,
  photograph,
}: {
  isActive: boolean;
  isSelected: boolean;
  onActivate: (photographId: string) => void;
  onLoadThumbnail: (
    relativePath: string,
    maxWidth: number,
    signal?: AbortSignal,
  ) => Promise<LibraryThumbnail>;
  onToggleSelection: (photographId: string) => void;
  photograph: LibraryPhotographRecord;
}) {
  const [thumbnail, setThumbnail] = useState<LibraryThumbnail | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const thumbnailRef = useRef<LibraryThumbnail | null>(null);
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
  }, [isMissing, onLoadThumbnail, photograph.relativePath]);

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
        onClick={() => onActivate(photograph.id)}
        onKeyDown={(event) => {
          if (event.key === ' ') {
            event.preventDefault();
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
                <span className="library-grid__placeholder" role="img">
                  Reading Source photograph
                </span>
              ) : null}
            </>
          ) : (
            <span className="library-grid__placeholder" role="img">
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
            {dispositionLabel(photograph)}
            {photograph.rating === null ? '' : ` · ${photograph.rating}/5`}
          </span>
        </span>
      </button>
    </div>
  );
}

export function LibraryGrid({
  activePhotographId,
  density,
  onActivate,
  onLoadThumbnail,
  onToggleSelection,
  photographs,
  selectedPhotographIds,
}: LibraryGridProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<GridGeometry>(() =>
    calculateGridGeometry(0, 0, density),
  );
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const measure = () => {
      setGeometry(calculateGridGeometry(viewport.clientWidth, viewport.clientHeight, density));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [density]);

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
            isActive={photograph.id === activePhotographId}
            isSelected={selectedPhotographIds.has(photograph.id)}
            key={`${photograph.id}-${photograph.fingerprint.byteSize}-${photograph.fingerprint.lastModified}-${photograph.sourceState}`}
            onActivate={onActivate}
            onLoadThumbnail={onLoadThumbnail}
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
      aria-label="Library Grid"
      aria-rowcount={rowCount}
      className="library-grid"
      ref={viewportRef}
      role="grid"
      onScroll={(event) => {
        const { clientHeight, scrollTop: nextScrollTop } = event.currentTarget;
        setScrollTop(nextScrollTop);
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
