import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neutralAdjustments } from '../editor/adjustments';

import {
  AdaptiveLibraryWorkspace,
  type AdaptiveLibraryWorkspaceProps,
} from './AdaptiveLibraryWorkspace';
import { createEmptyLibraryDocument, type LibraryPhotographRecord } from './libraryModel';

function photo(id: string): LibraryPhotographRecord {
  return {
    cameraSerial: 'camera',
    captureTime: `2026-01-01T00:00:0${id}`,
    disposition: 'unmarked',
    fileName: `${id}.jpg`,
    fingerprint: { byteSize: 1, lastModified: 1 },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: null,
    relativePath: `${id}.jpg`,
    sourceState: 'available',
  };
}

function props(
  overrides: Partial<AdaptiveLibraryWorkspaceProps> = {},
): AdaptiveLibraryWorkspaceProps {
  const library = {
    ...createEmptyLibraryDocument('Shoot'),
    photographs: [photo('1'), photo('2'), photo('3')],
  };
  return {
    customLooks: [],
    feedback: null,
    historyStatus: { canRedo: false, canUndo: false },
    onCancelScan: vi.fn(),
    onClose: vi.fn(),
    onCommit: vi.fn(async () => true),
    onDownloadLibraryBackup: vi.fn(),
    onLoadSource: vi.fn(async () => new File(['image'], 'photo.jpg', { type: 'image/jpeg' })),
    onLoadComparisonThumbnail: vi.fn(() => new Promise<never>(() => undefined)),
    onLoadThumbnail: vi.fn(() => new Promise<never>(() => undefined)),
    onPickExportDestination: vi.fn(async () => ({
      handle: {} as FileSystemDirectoryHandle,
      paths: [],
    })),
    onReadExportFile: vi.fn(async () => null),
    onRenderExport: vi.fn(async () => new Blob()),
    onReauthorize: vi.fn(),
    onReauthorizeScan: vi.fn(async () => undefined),
    onRedo: vi.fn(async () => true),
    onRefresh: vi.fn(),
    onRevert: vi.fn(),
    onRetry: vi.fn(),
    onSaveCopy: vi.fn(),
    onUndo: vi.fn(async () => true),
    onWriteExportFile: vi.fn(async () => undefined),
    snapshot: {
      library,
      libraryId: library.libraryId,
      message: 'Ready.',
      revision: { checksum: 'a'.repeat(64), revision: 1 },
      rootName: 'Shoot',
      scan: {
        error: null,
        message: 'Complete.',
        progress: {
          discoveredFiles: 3,
          metadataFailures: 0,
          processedFiles: 3,
          supportedFiles: 3,
          unsupportedFiles: 0,
        },
        status: 'complete',
        unsupportedFiles: [],
      },
      status: 'saved',
    },
    ...overrides,
  };
}

describe('Adaptive Library workstation', () => {
  it('culls from the keyboard with same-frame feedback and keeps Active separate from Selection', async () => {
    const options = props();
    render(<AdaptiveLibraryWorkspace {...options} />);
    const first = screen.getByRole('button', { name: /1\.jpg\. Source photograph/ });
    fireEvent.keyDown(first, { key: ' ' });
    expect(screen.getByLabelText('Selection count: 1')).toBeInTheDocument();
    fireEvent.keyDown(first, { key: 'p' });
    expect(screen.getByText('1.jpg: Pick.')).toHaveAttribute('role', 'status');
    await waitFor(() => expect(options.onCommit).toHaveBeenCalled());
  });

  it('guides the review workflow and enables Comparison after two photographs are selected', () => {
    render(<AdaptiveLibraryWorkspace {...props()} />);
    expect(screen.getByText('Saved')).toHaveClass('visually-hidden');
    expect(screen.getByRole('button', { name: 'Grid' })).not.toHaveAttribute('aria-describedby');
    const comparison = screen.getByRole('button', { name: 'Comparison' });
    expect(comparison).toBeDisabled();
    expect(comparison).toHaveAttribute('title', 'Select two to four photographs in Grid first');

    fireEvent.click(screen.getByLabelText('Photo actions for 1.jpg'));
    fireEvent.click(
      within(screen.getByLabelText('Review actions for 1.jpg')).getByRole('button', {
        name: 'Add to Selection',
      }),
    );
    fireEvent.click(screen.getByLabelText('Photo actions for 2.jpg'));
    fireEvent.click(
      within(screen.getByLabelText('Review actions for 2.jpg')).getByRole('button', {
        name: 'Add to Selection',
      }),
    );

    expect(comparison).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Compare 2' })).toBeEnabled();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('filters the Grid to Rejects from the Filters disclosure', () => {
    const options = props();
    options.snapshot = {
      ...options.snapshot,
      library: {
        ...options.snapshot.library!,
        photographs: [
          { ...photo('1'), disposition: 'pick' },
          { ...photo('2'), disposition: 'reject' },
          photo('3'),
        ],
      },
    };
    render(<AdaptiveLibraryWorkspace {...options} />);

    fireEvent.click(screen.getByText('Filters', { exact: true }));
    const statusFilter = screen.getByLabelText('Review status filter');
    expect(statusFilter).toHaveValue('');

    fireEvent.change(statusFilter, { target: { value: 'reject' } });

    expect(screen.getByRole('button', { name: /2\.jpg\. Source photograph/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /1\.jpg\. Source photograph/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(statusFilter, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /1\.jpg\. Source photograph/ })).toBeInTheDocument();
  });

  it('compares up to four photographs when Selection contains more', () => {
    const options = props();
    options.snapshot = {
      ...options.snapshot,
      library: {
        ...options.snapshot.library!,
        photographs: [photo('1'), photo('2'), photo('3'), photo('4'), photo('5')],
      },
    };
    render(<AdaptiveLibraryWorkspace {...options} />);
    const workspace = screen.getByRole('main');
    for (let index = 0; index < 4; index += 1) {
      fireEvent.keyDown(workspace, { key: 'ArrowRight', shiftKey: true });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Compare 4' }));

    expect(screen.getByText('Comparing the first 4 of 5 selected photographs.')).toHaveAttribute(
      'role',
      'status',
    );
    expect(document.querySelectorAll('.comparison-pane')).toHaveLength(4);
  });

  it('shows one clear next step when an opened folder has no photographs', () => {
    const options = props();
    options.snapshot = {
      ...options.snapshot,
      library: { ...options.snapshot.library!, photographs: [] },
      scan: {
        ...options.snapshot.scan,
        progress: {
          discoveredFiles: 0,
          metadataFailures: 0,
          processedFiles: 0,
          supportedFiles: 0,
          unsupportedFiles: 0,
        },
      },
    };
    render(<AdaptiveLibraryWorkspace {...options} />);

    expect(screen.getByRole('heading', { name: 'No photographs found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Library' })).toBeInTheDocument();
    expect(screen.queryByText(/No more matches/)).not.toBeInTheDocument();
  });

  it('opens one Edit section at a time and restores the invoking control on close', async () => {
    render(<AdaptiveLibraryWorkspace {...props()} />);
    const edit = screen.getByRole('button', { name: 'Edit' });
    edit.focus();
    fireEvent.click(edit);
    expect(screen.getByRole('dialog', { name: 'Edit inspector' })).toBeInTheDocument();
    expect(screen.getByRole('main').querySelector('[data-workstation-background]')).toHaveProperty(
      'inert',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Color' }));
    expect(screen.getByRole('button', { name: 'Color' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(edit).toHaveFocus());
  });

  it('persists Curve and Geometry controls through the Library command boundary', async () => {
    const options = props();
    render(<AdaptiveLibraryWorkspace {...options} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Curve' }));
    const midtone = screen.getByRole('slider', { name: 'Midtone output' });
    expect(midtone).toHaveValue('0.5');
    fireEvent.change(midtone, {
      target: { value: '0.63' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Geometry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate right' }));
    await waitFor(() => expect(options.onCommit).toHaveBeenCalledTimes(2));
    expect(options.onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        photographs: expect.arrayContaining([
          expect.objectContaining({ edit: expect.objectContaining({ revision: 2 }) }),
        ]),
      }),
      expect.stringMatching(/Saved Edit revision/),
    );
  });

  it('blocks review and Edit mutations during Unsaved recovery', () => {
    const options = props({
      snapshot: { ...props().snapshot, status: 'unsaved' },
    });
    render(<AdaptiveLibraryWorkspace {...options} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('main'), { key: 'p' });
    expect(options.onCommit).not.toHaveBeenCalled();
    expect(screen.getByText(/Resolve the current Library recovery state/)).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('restores Grid scroll context after Loupe and bounds the nearby filmstrip', () => {
    const options = props();
    const many = Array.from({ length: 100 }, (_, index) => photo(String(index).padStart(3, '0')));
    options.snapshot = {
      ...options.snapshot,
      library: { ...options.snapshot.library!, photographs: many },
    };
    render(<AdaptiveLibraryWorkspace {...options} />);
    const grid = screen.getByRole('grid', { name: 'Library Grid' });
    Object.defineProperty(grid, 'scrollTop', { configurable: true, value: 600, writable: true });
    fireEvent.scroll(grid);
    fireEvent.keyDown(screen.getByRole('main'), { key: 'Enter' });
    expect(
      screen.getByLabelText('Nearby photographs').querySelectorAll('button').length,
    ).toBeLessThanOrEqual(21);
    fireEvent.keyDown(screen.getByRole('main'), { key: 'Escape' });
    expect(screen.getByRole('grid', { name: 'Library Grid' }).scrollTop).toBe(600);
  });

  it('exposes imported legacy Looks as usable inspector actions', async () => {
    const options = props({
      customLooks: [
        {
          adjustments: {
            ...neutralAdjustments,
            exposure: 1,
          },
          createdAt: 1,
          description: '',
          id: 'legacy-look',
          title: 'Legacy Portra',
          updatedAt: 1,
        },
      ],
    });
    render(<AdaptiveLibraryWorkspace {...options} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Looks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Legacy Portra' }));
    await waitFor(() => expect(options.onCommit).toHaveBeenCalled());
  });

  it('offers reauthorization and resume when Refresh loses folder permission', () => {
    const options = props();
    options.snapshot = {
      ...options.snapshot,
      scan: {
        ...options.snapshot.scan,
        error: 'OpenFilm lost permission to read the Library folder.',
        status: 'failed',
      },
    };
    render(<AdaptiveLibraryWorkspace {...options} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reauthorize and resume' }));
    expect(options.onReauthorizeScan).toHaveBeenCalledOnce();
  });
});
