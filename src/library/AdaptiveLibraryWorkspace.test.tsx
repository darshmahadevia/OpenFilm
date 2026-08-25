import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
    feedback: null,
    historyStatus: { canRedo: false, canUndo: false },
    onCancelScan: vi.fn(),
    onClose: vi.fn(),
    onCommit: vi.fn(async () => undefined),
    onLoadSource: vi.fn(async () => new File(['image'], 'photo.jpg', { type: 'image/jpeg' })),
    onLoadThumbnail: vi.fn(() => new Promise<never>(() => undefined)),
    onPickExportDestination: vi.fn(async () => ({
      handle: {} as FileSystemDirectoryHandle,
      paths: [],
    })),
    onReadExportFile: vi.fn(async () => null),
    onReauthorize: vi.fn(),
    onRedo: vi.fn(async () => undefined),
    onRefresh: vi.fn(),
    onRevert: vi.fn(),
    onRetry: vi.fn(),
    onSaveCopy: vi.fn(),
    onUndo: vi.fn(async () => undefined),
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
    const first = screen.getByRole('button', { name: /1\.jpg/ });
    fireEvent.keyDown(first, { key: ' ' });
    expect(screen.getByLabelText('Selection count: 1')).toBeInTheDocument();
    fireEvent.keyDown(first, { key: 'p' });
    expect(screen.getByText('1.jpg: Pick.')).toHaveAttribute('role', 'status');
    await waitFor(() => expect(options.onCommit).toHaveBeenCalled());
  });

  it('keeps an invalid Comparison request attached to the current mode', () => {
    render(<AdaptiveLibraryWorkspace {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Comparison' }));
    expect(screen.getByText(/two to four/)).toHaveAttribute('role', 'status');
    expect(screen.getByRole('grid', { name: 'Library Grid' })).toBeInTheDocument();
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
    fireEvent.change(screen.getByRole('slider', { name: 'Midtone output' }), {
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
});
