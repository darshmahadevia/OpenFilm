import bundledSampleUrl from '../assets/openfilm-demo-greenhouse-square.webp?inline';

const bundledSamplePhotograph = {
  fileName: 'openfilm-greenhouse.webp',
  mimeType: 'image/webp',
};

export function createBundledSamplePhotographFile(): File {
  const encoded = bundledSampleUrl.split(',')[1];

  if (!encoded) {
    throw new Error('The bundled sample photograph could not be read.');
  }

  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new File([bytes], bundledSamplePhotograph.fileName, {
    type: bundledSamplePhotograph.mimeType,
  });
}
