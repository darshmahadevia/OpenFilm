import { createLibraryMetadataExtractor, parsePhotographMetadata } from './libraryMetadata';

function createExifJpeg(): Uint8Array {
  const date = new TextEncoder().encode('2024:03:05 14:06:07\0');
  const serial = new TextEncoder().encode('CAM-01\0\0');
  const tiff = new Uint8Array(66);
  const view = new DataView(tiff.buffer);

  tiff.set([0x4d, 0x4d], 0);
  view.setUint16(2, 42, false);
  view.setUint32(4, 8, false);
  view.setUint16(8, 2, false);
  view.setUint16(10, 0x9003, false);
  view.setUint16(12, 2, false);
  view.setUint32(14, date.length, false);
  view.setUint32(18, 38, false);
  view.setUint16(22, 0xa431, false);
  view.setUint16(24, 2, false);
  view.setUint32(26, serial.length, false);
  view.setUint32(30, 58, false);
  tiff.set(date, 38);
  tiff.set(serial, 58);

  const exif = new Uint8Array(6 + tiff.length);
  exif.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
  exif.set(tiff, 6);

  const jpeg = new Uint8Array(2 + 2 + 2 + exif.length + 2);
  const viewJpeg = new DataView(jpeg.buffer);
  jpeg.set([0xff, 0xd8, 0xff, 0xe1], 0);
  viewJpeg.setUint16(4, exif.length + 2, false);
  jpeg.set(exif, 6);
  jpeg.set([0xff, 0xd9], 6 + exif.length);
  return jpeg;
}

describe('Library EXIF metadata reader', () => {
  it('reads camera-local capture time and camera serial from JPEG EXIF', () => {
    expect(parsePhotographMetadata(createExifJpeg())).toEqual({
      cameraSerial: 'CAM-01',
      captureTime: '2024-03-05T14:06:07',
      orientation: null,
    });
  });

  it('uses the bounded fallback reader when a worker is unavailable', async () => {
    const extractor = createLibraryMetadataExtractor({ createWorker: () => null });
    const bytes = createExifJpeg();
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);

    await expect(
      extractor.extract(new File([buffer], 'capture.jpg', { type: 'image/jpeg' })),
    ).resolves.toMatchObject({
      cameraSerial: 'CAM-01',
      captureTime: '2024-03-05T14:06:07',
    });

    extractor.dispose();
  });

  it('uses the worker client with a transferred bounded buffer', async () => {
    const worker = {
      onerror: null,
      onmessage: null,
      postMessage: vi.fn((message: { id: number }, transfer: Transferable[]) => {
        expect(transfer).toHaveLength(1);
        queueMicrotask(() => {
          worker.onmessage?.({
            data: {
              id: message.id,
              metadata: {
                cameraSerial: 'WORKER-CAM',
                captureTime: '2024-03-05T14:06:07',
                orientation: 6,
              },
              ok: true,
            },
          } as MessageEvent);
        });
      }),
      terminate: vi.fn(),
    } as unknown as {
      onerror: ((event: ErrorEvent) => void) | null;
      onmessage: ((event: MessageEvent) => void) | null;
      postMessage: (message: unknown, transfer: Transferable[]) => void;
      terminate: () => void;
    };
    const extractor = createLibraryMetadataExtractor({ createWorker: () => worker });

    await expect(
      extractor.extract(new File(['image'], 'capture.jpg', { type: 'image/jpeg' })),
    ).resolves.toEqual({
      cameraSerial: 'WORKER-CAM',
      captureTime: '2024-03-05T14:06:07',
      orientation: 6,
    });

    extractor.dispose();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
