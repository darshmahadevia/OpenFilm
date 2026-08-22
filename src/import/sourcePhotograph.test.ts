import {
  describeSourcePhotographImportError,
  importSourcePhotograph,
  MAX_SOURCE_PHOTOGRAPH_DIMENSION,
  MAX_SOURCE_PHOTOGRAPH_FILE_SIZE,
  type SourcePhotographImportDependencies,
  SourcePhotographImportError,
} from './index';
import {
  createSourcePhotographFixtureFile,
  sourcePhotographFixtures,
} from './sourcePhotographFixtures';

interface FixtureImage extends Pick<HTMLImageElement, 'decode' | 'naturalHeight' | 'naturalWidth'> {
  readonly removedSource: boolean;
  readonly orientation: string | undefined;
  onerror: (() => void) | null;
  onload: (() => void) | null;
  removeAttribute: (attributeName: string) => void;
  setSource: (objectUrl: string) => void;
}

function createFixtureImage(
  fixture: (typeof sourcePhotographFixtures)[number],
  shouldDecode = true,
): FixtureImage {
  let removedSource = false;
  let sourceUrl = '';
  let orientation: string | undefined;
  let onload: (() => void) | null = null;
  let onerror: (() => void) | null = null;

  const image = {
    decode: vi.fn(async () => {
      if (!shouldDecode) {
        throw new Error('fixture decode failed');
      }
    }),
    get naturalHeight() {
      return fixture.height;
    },
    get naturalWidth() {
      return fixture.width;
    },
    get orientation() {
      return orientation;
    },
    get removedSource() {
      return removedSource;
    },
    set onerror(handler: (() => void) | null) {
      onerror = handler;
    },
    get onerror() {
      return onerror;
    },
    set onload(handler: (() => void) | null) {
      onload = handler;
    },
    get onload() {
      return onload;
    },
    removeAttribute(attributeName: string) {
      if (attributeName === 'src') {
        removedSource = true;
        sourceUrl = '';
      }
    },
    setSource(objectUrl: string) {
      sourceUrl = objectUrl;
      orientation = 'from-image';
      queueMicrotask(() => {
        if (sourceUrl !== objectUrl) {
          return;
        }

        if (shouldDecode) {
          onload?.();
        } else {
          onerror?.();
        }
      });
    },
    style: {
      setProperty: vi.fn((propertyName: string, value: string) => {
        if (propertyName === 'image-orientation') {
          orientation = value;
        }
      }),
    },
    set src(objectUrl: string) {
      image.setSource(objectUrl);
    },
  } as unknown as FixtureImage;

  return image;
}

function createDependencies(
  image: FixtureImage,
  createdObjectUrl = 'blob:fixture',
): SourcePhotographImportDependencies & {
  createObjectUrl: ReturnType<typeof vi.fn>;
  revokeObjectUrl: ReturnType<typeof vi.fn>;
} {
  const createObjectUrl = vi.fn((file: File) => {
    void file;
    return createdObjectUrl;
  });
  const revokeObjectUrl = vi.fn((objectUrl: string) => {
    void objectUrl;
  });

  return {
    createImage: () => image as unknown as HTMLImageElement,
    createObjectUrl,
    revokeObjectUrl,
  };
}

describe('source photograph import', () => {
  it.each(sourcePhotographFixtures)(
    'decodes the $mimeType fixture with browser orientation enabled',
    async (fixture) => {
      const image = createFixtureImage(fixture);
      const dependencies = createDependencies(image, `blob:${fixture.fileName}`);

      const imported = await importSourcePhotograph(
        createSourcePhotographFixtureFile(fixture),
        dependencies,
      );

      expect(imported).toMatchObject({
        fileName: fixture.fileName,
        height: fixture.height,
        mimeType: fixture.mimeType,
        objectUrl: `blob:${fixture.fileName}`,
        width: fixture.width,
      });
      expect(image.orientation).toBe(fixture.orientation);
      expect(image.removedSource).toBe(true);
      expect(dependencies.revokeObjectUrl).not.toHaveBeenCalled();
    },
  );

  it('rejects unsupported MIME types before creating a local resource', async () => {
    const dependencies = createDependencies(createFixtureImage(sourcePhotographFixtures[0]));
    const file = new File(['not an image'], 'notes.gif', { type: 'image/gif' });

    await expect(importSourcePhotograph(file, dependencies)).rejects.toMatchObject({
      code: 'unsupported-type',
    });
    expect(dependencies.createObjectUrl).not.toHaveBeenCalled();
  });

  it('rejects files over the documented limit before decoding', async () => {
    const dependencies = createDependencies(createFixtureImage(sourcePhotographFixtures[0]));
    const file = new File(['small fixture'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: MAX_SOURCE_PHOTOGRAPH_FILE_SIZE + 1 });

    await expect(importSourcePhotograph(file, dependencies)).rejects.toMatchObject({
      code: 'file-too-large',
    });
    expect(dependencies.createObjectUrl).not.toHaveBeenCalled();
  });

  it('releases the object URL and image source after a decode failure', async () => {
    const image = createFixtureImage(sourcePhotographFixtures[0], false);
    const dependencies = createDependencies(image, 'blob:broken');
    const file = createSourcePhotographFixtureFile(sourcePhotographFixtures[0]);

    await expect(importSourcePhotograph(file, dependencies)).rejects.toMatchObject({
      code: 'decode-failed',
    });
    expect(image.removedSource).toBe(true);
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith('blob:broken');
  });

  it('rejects decoded dimensions outside the browser preview limits', async () => {
    const fixture = {
      ...sourcePhotographFixtures[0],
      width: MAX_SOURCE_PHOTOGRAPH_DIMENSION + 1,
    };
    const image = createFixtureImage(fixture);
    const dependencies = createDependencies(image, 'blob:too-wide');

    await expect(
      importSourcePhotograph(createSourcePhotographFixtureFile(fixture), dependencies),
    ).rejects.toMatchObject({ code: 'dimensions-too-large' });
    expect(dependencies.revokeObjectUrl).toHaveBeenCalledWith('blob:too-wide');
  });

  it('explains import failures in plain language', () => {
    expect(
      describeSourcePhotographImportError(
        new SourcePhotographImportError('unsupported-type', 'unsupported'),
        'notes.gif',
      ),
    ).toContain('Choose a JPEG, PNG, or WebP file');
    expect(
      describeSourcePhotographImportError(
        new SourcePhotographImportError('file-too-large', 'too large'),
        'large.jpg',
      ),
    ).toContain('20 MiB');
  });
});
