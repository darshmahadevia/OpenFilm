import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { LibraryGrid } from './LibraryGrid';
import type { LibraryThumbnail } from './libraryThumbnail';
import type { LibraryPhotographRecord } from './libraryModel';

function createPhotograph(id: string, relativePath: string): LibraryPhotographRecord {
  return {
    cameraSerial: null,
    captureTime: null,
    disposition: 'unmarked',
    fileName: relativePath.split('/').at(-1) ?? relativePath,
    fingerprint: { byteSize: 5, lastModified: 100 },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: null,
    relativePath,
    sourceState: 'available',
  };
}

describe('Library Grid', () => {
  it('renders fixed-geometry rows, loads visible Source photographs, and separates Active from Selection', async () => {
    const first = createPhotograph('photo-1', 'one.jpg');
    const second = createPhotograph('photo-2', 'nested/two.jpg');
    const onActivate = vi.fn();
    const onOpenLoupe = vi.fn();
    const onReview = vi.fn();
    const onToggleSelection = vi.fn();
    const dispose = vi.fn();
    const thumbnail: LibraryThumbnail = { bytes: 1, dispose, url: 'blob:grid-photo' };

    const { container, unmount } = render(
      <LibraryGrid
        activePhotographId="photo-1"
        canReview
        density="standard"
        onActivate={onActivate}
        onLoadThumbnail={async () => thumbnail}
        onOpenLoupe={onOpenLoupe}
        onReview={onReview}
        onToggleSelection={onToggleSelection}
        photographs={[first, second]}
        selectedPhotographIds={new Set(['photo-2'])}
      />,
    );

    const grid = screen.getByRole('grid', { name: 'Library Grid' });
    expect(grid).toHaveAttribute('aria-rowcount', '2');
    expect(screen.getByRole('button', { name: /one\.jpg\. Source photograph/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: /nested\/two\.jpg/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: /one\.jpg\. Source photograph/ }));
    fireEvent.keyDown(screen.getByRole('button', { name: /nested\/two\.jpg/ }), { key: ' ' });

    expect(onActivate).toHaveBeenCalledWith('photo-1');
    expect(onToggleSelection).toHaveBeenCalledWith('photo-2');
    fireEvent.click(screen.getByLabelText('Photo actions for one.jpg'));
    fireEvent.click(
      within(screen.getByLabelText('Review actions for one.jpg')).getByRole('button', {
        name: 'Mark as Pick',
      }),
    );
    expect(onReview).toHaveBeenCalledWith('photo-1', {
      kind: 'set-disposition',
      disposition: 'pick',
    });
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
    for (const image of container.querySelectorAll('img')) fireEvent.load(image);
    await waitFor(() => expect(screen.queryAllByText('Reading Source photograph')).toHaveLength(0));

    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('virtualizes rows and recalculates fixed columns when density changes', async () => {
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 960,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 320,
    });

    try {
      const photographs = Array.from({ length: 24 }, (_, index) =>
        createPhotograph(`photo-${index}`, `photo-${index}.jpg`),
      );
      const { rerender } = render(
        <LibraryGrid
          activePhotographId="photo-0"
          canReview
          density="standard"
          onActivate={vi.fn()}
          onLoadThumbnail={async () => ({ bytes: 1, dispose: vi.fn(), url: 'blob:grid-photo' })}
          onOpenLoupe={vi.fn()}
          onReview={vi.fn()}
          onToggleSelection={vi.fn()}
          photographs={photographs}
          selectedPhotographIds={new Set()}
        />,
      );

      const grid = screen.getByRole('grid', { name: 'Library Grid' });
      expect(grid).toHaveAttribute('aria-rowcount', '8');
      expect(grid).toHaveAttribute('aria-colcount', '3');
      expect(screen.getAllByRole('gridcell').length).toBeLessThan(24);

      rerender(
        <LibraryGrid
          activePhotographId="photo-0"
          canReview
          density="overview"
          onActivate={vi.fn()}
          onLoadThumbnail={async () => ({ bytes: 1, dispose: vi.fn(), url: 'blob:grid-photo' })}
          onOpenLoupe={vi.fn()}
          onReview={vi.fn()}
          onToggleSelection={vi.fn()}
          photographs={photographs}
          selectedPhotographIds={new Set()}
        />,
      );

      await waitFor(() => expect(grid).toHaveAttribute('aria-colcount', '5'));
      expect(grid).toHaveAttribute('aria-rowcount', '5');
    } finally {
      if (originalWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalWidth);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
      }

      if (originalHeight) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalHeight);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
      }
    }
  });
});
