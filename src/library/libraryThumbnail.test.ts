import { createLibraryGridThumbnail } from './libraryThumbnail';

describe('Library Grid thumbnails', () => {
  it('uses a transient object URL fallback when browser bitmap APIs are unavailable', async () => {
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const createObjectUrl = vi.fn(() => 'blob:grid-thumbnail');
    const revokeObjectUrl = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });

    try {
      const thumbnail = await createLibraryGridThumbnail(
        new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
      );

      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      thumbnail.dispose();
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:grid-thumbnail');
    } finally {
      if (originalCreateObjectUrl) {
        Object.defineProperty(URL, 'createObjectURL', {
          configurable: true,
          value: originalCreateObjectUrl,
        });
      } else {
        Reflect.deleteProperty(URL, 'createObjectURL');
      }

      if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, 'revokeObjectURL', {
          configurable: true,
          value: originalRevokeObjectUrl,
        });
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    }
  });
});
