import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import App from './App';
import {
  createSourcePhotographFixtureFile,
  sourcePhotographFixtures,
} from './import/sourcePhotographFixtures';

class TestImage {
  naturalHeight = 4;
  naturalWidth = 3;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  readonly style = { setProperty: vi.fn() };

  decode = vi.fn(async () => undefined);

  set src(_objectUrl: string) {
    queueMicrotask(() => this.onload?.());
  }

  removeAttribute() {}
}

function installImportBrowserMocks() {
  const createObjectUrl = vi.fn((file: File) => `blob:${file.name}`);
  const revokeObjectUrl = vi.fn();
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectUrl,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectUrl,
    writable: true,
  });
  vi.stubGlobal('Image', TestImage);

  return {
    createObjectUrl,
    revokeObjectUrl,
    restore() {
      if (originalCreateObjectUrl) {
        Object.defineProperty(URL, 'createObjectURL', {
          configurable: true,
          value: originalCreateObjectUrl,
          writable: true,
        });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }

      if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, 'revokeObjectURL', {
          configurable: true,
          value: originalRevokeObjectUrl,
          writable: true,
        });
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }

      vi.unstubAllGlobals();
    },
  };
}

describe('OpenFilm shell', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives the preview priority and shows one active tool area', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Your photograph, in focus.' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Adjust', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Adjustments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import photograph' })).toBeInTheDocument();
    expect(screen.getByText(/OpenFilm needs WebGL2/)).toBeInTheDocument();
  });

  it('switches tools and opens the help dialog', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Geometry' }));
    expect(screen.getByRole('heading', { name: 'Geometry' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Geometry', selected: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open editor help' }));
    expect(screen.getByRole('dialog', { name: 'A quiet place to edit' })).toBeInTheDocument();
  });

  it('imports a supported source photograph from the picker and releases the prior preview', async () => {
    const mocks = installImportBrowserMocks();
    const firstFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);
    const secondFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[1]);

    try {
      render(<App />);

      const input = screen.getByLabelText('Choose source photograph');
      fireEvent.change(input, { target: { files: [firstFile] } });

      expect(await screen.findByText(/Loaded orientation-6-portrait\.jpg/)).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();
      expect(mocks.createObjectUrl).toHaveBeenCalledWith(firstFile);

      fireEvent.change(input, { target: { files: [secondFile] } });

      expect(await screen.findByText(/Loaded landscape\.png/)).toBeInTheDocument();
      await waitFor(() =>
        expect(mocks.revokeObjectUrl).toHaveBeenCalledWith('blob:orientation-6-portrait.jpg'),
      );
      expect(
        screen.queryByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'landscape.png' })).toBeInTheDocument();
    } finally {
      mocks.restore();
    }
  });

  it('reports an unsupported dropped file without replacing the current source', async () => {
    const mocks = installImportBrowserMocks();
    const supportedFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);
    const unsupportedFile = new File(['not a photograph'], 'notes.gif', { type: 'image/gif' });

    try {
      render(<App />);

      const importArea = screen.getByRole('group', { name: 'Source photograph import area' });
      fireEvent.change(screen.getByLabelText('Choose source photograph'), {
        target: { files: [supportedFile] },
      });
      expect(
        await screen.findByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();

      fireEvent.drop(importArea, { dataTransfer: { files: [unsupportedFile] } });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Choose a JPEG, PNG, or WebP file',
      );
      expect(
        screen.getByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();
      expect(mocks.createObjectUrl).toHaveBeenCalledTimes(1);
    } finally {
      mocks.restore();
    }
  });

  it('loads the bundled sample photograph without a user file', async () => {
    const mocks = installImportBrowserMocks();

    try {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'Try bundled sample' }));

      expect(
        await screen.findByRole('heading', { name: 'openfilm-sample.png' }),
      ).toBeInTheDocument();
      expect(mocks.createObjectUrl).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'openfilm-sample.png', type: 'image/png' }),
      );
    } finally {
      mocks.restore();
    }
  });

  it('supports numeric adjustment entry and undoable individual and all-control resets', async () => {
    const mocks = installImportBrowserMocks();
    const sourceFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);

    try {
      render(<App />);
      const input = screen.getByLabelText('Choose source photograph');
      fireEvent.change(input, { target: { files: [sourceFile] } });
      expect(
        await screen.findByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();

      const temperatureValue = screen.getByLabelText('Temperature value');
      fireEvent.change(temperatureValue, { target: { value: '35' } });
      expect(temperatureValue).toHaveValue(35);
      expect(screen.getByLabelText('Temperature')).toHaveValue('35');

      fireEvent.click(screen.getByRole('button', { name: 'Reset Temperature' }));
      expect(temperatureValue).toHaveValue(0);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(temperatureValue).toHaveValue(35);

      const exposureValue = screen.getByLabelText('Exposure value');
      const saturationValue = screen.getByLabelText('Saturation value');
      fireEvent.change(exposureValue, { target: { value: '1.5' } });
      fireEvent.change(saturationValue, { target: { value: '-40' } });
      fireEvent.click(screen.getByRole('button', { name: 'Reset adjustments' }));
      expect(exposureValue).toHaveValue(0);
      expect(saturationValue).toHaveValue(0);

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(exposureValue).toHaveValue(1.5);
      expect(saturationValue).toHaveValue(-40);
    } finally {
      mocks.restore();
    }
  });

  it('resets adjustments and confirms replacing a source with a changed edit', async () => {
    const mocks = installImportBrowserMocks();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const firstFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);
    const rejectedReplacement = createSourcePhotographFixtureFile(sourcePhotographFixtures[1]);
    const acceptedReplacement = createSourcePhotographFixtureFile(sourcePhotographFixtures[2]);

    try {
      render(<App />);

      const input = screen.getByLabelText('Choose source photograph');
      fireEvent.change(input, { target: { files: [firstFile] } });
      expect(
        await screen.findByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();

      const exposure = screen.getByLabelText('Exposure');
      fireEvent.change(exposure, { target: { value: '0.5' } });
      expect(exposure).toHaveValue('0.5');

      fireEvent.click(screen.getByRole('button', { name: 'Reset adjustments' }));
      expect(exposure).toHaveValue('0');

      fireEvent.change(exposure, { target: { value: '0.5' } });
      fireEvent.change(input, { target: { files: [rejectedReplacement] } });

      expect(
        await screen.findByText('The current source photograph is still open.'),
      ).toBeInTheDocument();
      expect(confirm).toHaveBeenCalledWith(
        'Replace the current source photograph? The current adjustment state will be reset.',
      );
      expect(
        screen.getByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();
      expect(exposure).toHaveValue('0.5');
      expect(mocks.revokeObjectUrl).toHaveBeenCalledWith('blob:landscape.png');

      confirm.mockReturnValue(true);
      fireEvent.change(input, { target: { files: [acceptedReplacement] } });

      expect(await screen.findByText(/Loaded square\.webp/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'square.webp' })).toBeInTheDocument();
      expect(exposure).toHaveValue('0');
      await waitFor(() =>
        expect(mocks.revokeObjectUrl).toHaveBeenCalledWith('blob:orientation-6-portrait.jpg'),
      );
    } finally {
      mocks.restore();
    }
  });
});
