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

  it('explains unavailable recovery and supports bundled and custom Look CRUD', async () => {
    const mocks = installImportBrowserMocks();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    try {
      render(<App />);
      expect(screen.getByText(/remain in memory until this tab closes/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Try bundled sample' }));
      expect(
        await screen.findByRole('heading', { name: 'openfilm-sample.png' }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: 'Looks' }));
      expect(screen.getByRole('heading', { name: 'Bundled Looks' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply Quiet Morning' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply Street Dust' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Apply Quiet Morning' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Adjust' }));
      expect(screen.getByLabelText('Exposure')).toHaveValue('0.35');

      fireEvent.click(screen.getByRole('tab', { name: 'Looks' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save current Look' }));
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My saved Look' } });
      fireEvent.change(screen.getByLabelText('Description'), {
        target: { value: 'A look I want to use again.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Look' }));
      expect(screen.getByRole('heading', { name: 'My saved Look' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Rename My saved Look' }));
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed Look' } });
      fireEvent.click(screen.getByRole('button', { name: 'Rename Look' }));
      expect(screen.getByRole('heading', { name: 'Renamed Look' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate Renamed Look' }));
      expect(screen.getByRole('heading', { name: 'Renamed Look copy' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete Renamed Look' }));
      expect(screen.queryByRole('heading', { name: 'Renamed Look' })).not.toBeInTheDocument();
      expect(confirm).toHaveBeenCalledWith(
        'Delete “Renamed Look”? This saved Look cannot be recovered.',
      );
    } finally {
      confirm.mockRestore();
      mocks.restore();
    }
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

  it('coalesces a slider gesture into one shared history entry', async () => {
    const mocks = installImportBrowserMocks();
    const sourceFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);

    try {
      render(<App />);
      fireEvent.change(screen.getByLabelText('Choose source photograph'), {
        target: { files: [sourceFile] },
      });
      expect(
        await screen.findByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();

      const exposure = screen.getByLabelText('Exposure');
      fireEvent.pointerDown(exposure);
      fireEvent.change(exposure, { target: { value: '0.25' } });
      fireEvent.change(exposure, { target: { value: '0.5' } });
      fireEvent.pointerUp(exposure);

      expect(exposure).toHaveValue('0.5');
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(exposure).toHaveValue('0');
    } finally {
      mocks.restore();
    }
  });

  it('supports bounded vignette and grain controls with undoable group resets', async () => {
    const mocks = installImportBrowserMocks();
    const sourceFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);

    try {
      render(<App />);
      fireEvent.change(screen.getByLabelText('Choose source photograph'), {
        target: { files: [sourceFile] },
      });
      expect(
        await screen.findByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();

      const values = {
        'Vignette amount': 65,
        'Vignette softness': 80,
        'Grain amount': 35,
        'Grain size': 22,
      } as const;

      for (const [label, value] of Object.entries(values)) {
        const input = screen.getByLabelText(`${label} value`);
        fireEvent.change(input, { target: { value: value.toString() } });
        expect(input).toHaveValue(value);
      }

      fireEvent.click(screen.getByRole('button', { name: 'Reset Vignette' }));
      expect(screen.getByLabelText('Vignette amount value')).toHaveValue(0);
      expect(screen.getByLabelText('Vignette softness value')).toHaveValue(50);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(screen.getByLabelText('Vignette amount value')).toHaveValue(65);
      expect(screen.getByLabelText('Vignette softness value')).toHaveValue(80);

      fireEvent.click(screen.getByRole('button', { name: 'Reset Grain' }));
      expect(screen.getByLabelText('Grain amount value')).toHaveValue(0);
      expect(screen.getByLabelText('Grain size value')).toHaveValue(50);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(screen.getByLabelText('Grain amount value')).toHaveValue(35);
      expect(screen.getByLabelText('Grain size value')).toHaveValue(22);
    } finally {
      mocks.restore();
    }
  });

  it('supports adding, selecting, numerically editing, keyboard moving, and removing a curve point', async () => {
    const mocks = installImportBrowserMocks();
    const sourceFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);

    try {
      render(<App />);
      fireEvent.change(screen.getByLabelText('Choose source photograph'), {
        target: { files: [sourceFile] },
      });
      expect(
        await screen.findByRole('heading', { name: 'orientation-6-portrait.jpg' }),
      ).toBeInTheDocument();

      expect(screen.getByText('2 / 8 points')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Add tone curve point' }));
      expect(screen.getByText('3 / 8 points')).toBeInTheDocument();

      const input = screen.getByLabelText('Input (x)');
      const output = screen.getByLabelText('Output (y)');
      expect(input).toHaveValue(0.5);
      expect(output).toHaveValue(0.5);

      fireEvent.change(input, { target: { value: '0.25' } });
      expect(input).toHaveValue(0.25);

      const selectedPoint = screen.getByRole('button', {
        name: /Tone curve point 2, input 0\.25, output 0\.50/,
      });
      fireEvent.keyDown(selectedPoint, { key: 'ArrowUp' });
      expect(output).toHaveValue(0.51);

      fireEvent.click(screen.getByRole('button', { name: 'Remove selected tone curve point' }));
      expect(screen.getByText('2 / 8 points')).toBeInTheDocument();
    } finally {
      mocks.restore();
    }
  });

  it('supports normalized crop fields, aspect ratios, rotation, flips, and geometry history', async () => {
    const mocks = installImportBrowserMocks();
    const sourceFile = createSourcePhotographFixtureFile(sourcePhotographFixtures[1]);

    try {
      render(<App />);
      fireEvent.change(screen.getByLabelText('Choose source photograph'), {
        target: { files: [sourceFile] },
      });
      expect(await screen.findByRole('heading', { name: 'landscape.png' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: 'Geometry' }));
      expect(screen.getByRole('group', { name: 'Crop preview' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Resize crop top left' })).toBeInTheDocument();

      const width = screen.getByLabelText('Crop width value');
      fireEvent.change(width, { target: { value: '60' } });
      expect(width).toHaveValue(60);

      fireEvent.change(screen.getByLabelText('Aspect ratio'), { target: { value: '1:1' } });
      expect(screen.getByLabelText('Crop width value')).toHaveValue(60);
      expect(screen.getByLabelText('Crop height value')).toHaveValue(45);

      fireEvent.change(screen.getByLabelText('Rotation'), { target: { value: '90' } });
      expect(screen.getByLabelText('Rotation')).toHaveValue('90');
      fireEvent.click(screen.getByRole('button', { name: 'Horizontal' }));
      expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
      expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Reset geometry' }));
      expect(screen.getByLabelText('Rotation')).toHaveValue('0');
      expect(screen.getByLabelText('Crop width value')).toHaveValue(100);
      expect(screen.getByRole('button', { name: 'Horizontal' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
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
        'Replace the current source photograph? The current adjustment state will be reset. Geometry will reset with it.',
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
