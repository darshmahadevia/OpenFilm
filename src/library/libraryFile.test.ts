import {
  canonicalizeJson,
  createLibraryFileEnvelope,
  LibraryFileFormatError,
  serializeLibraryFile,
  sha256Hex,
  verifySerializedLibraryFile,
  type LibraryDocument,
} from './libraryFile';

const library: LibraryDocument = {
  libraryId: 'library-1',
  photographs: [
    { disposition: 'unmarked', id: 'photo-1', rating: null },
    { disposition: 'pick', id: 'photo-2', rating: 4 },
  ],
  rootName: 'June shoot',
};

describe('versioned Library files', () => {
  it('canonicalizes object keys and verifies a checksum-bound revision', async () => {
    expect(canonicalizeJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');

    const first = await createLibraryFileEnvelope(library, 1, null, { writtenAt: 10 });
    const restored = await verifySerializedLibraryFile(serializeLibraryFile(first));

    expect(restored).toEqual(first);
    expect(restored.checksum).toHaveLength(64);
  });

  it('binds a child revision to its exact parent', async () => {
    const first = await createLibraryFileEnvelope(library, 1, null, { writtenAt: 10 });
    const second = await createLibraryFileEnvelope(
      { ...library, rootName: 'July shoot' },
      2,
      { checksum: first.checksum, revision: first.revision },
      { writtenAt: 11 },
    );

    expect(second.parentRevision).toBe(1);
    expect(second.parentChecksum).toBe(first.checksum);
    await expect(verifySerializedLibraryFile(serializeLibraryFile(second))).resolves.toEqual(
      second,
    );
  });

  it('rejects truncation and content tampering before a revision can be loaded', async () => {
    const first = await createLibraryFileEnvelope(library, 1, null, { writtenAt: 10 });
    const bytes = serializeLibraryFile(first);

    await expect(verifySerializedLibraryFile(bytes.slice(0, -7))).rejects.toBeInstanceOf(
      LibraryFileFormatError,
    );

    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 4] ^= 0xff;

    await expect(verifySerializedLibraryFile(tampered)).rejects.toBeInstanceOf(
      LibraryFileFormatError,
    );
  });

  it('uses browser Web Crypto SHA-256 for the checksum', async () => {
    await expect(sha256Hex('openfilm')).resolves.toBe(
      'bfae0b697392d49485d567a09cdae25fecd6d0fc305f73162670e07af64ec3e7',
    );
  });
});
