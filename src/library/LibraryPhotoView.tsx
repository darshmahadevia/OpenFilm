import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { neutralGeometry } from '../editor/geometry';
import {
  createRenderer,
  neutralRendererAdjustments,
  type PreviewRenderer,
} from '../rendering/renderer';
import { getLibraryEdit } from './libraryReview';
import type { LibraryPhotographRecord } from './libraryModel';

interface LibraryPhotoViewProps {
  photograph: LibraryPhotographRecord;
  onLoadSource: (relativePath: string) => Promise<File>;
  sourceView: boolean;
  zoomScale: number;
}

function readImageSize(objectUrl: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = () => reject(new Error('OpenFilm could not decode this Source photograph.'));
    image.src = objectUrl;
  });
}

export function LibraryPhotoView({
  photograph,
  onLoadSource,
  sourceView,
  zoomScale,
}: LibraryPhotoViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const [message, setMessage] = useState('Reading Source photograph.');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas, {
      onError: (error) => setMessage(error.message),
      onStatusChange: (status) => {
        if (status === 'context-lost')
          setMessage(
            'Graphics context lost. OpenFilm will restore this view when the browser recovers it.',
          );
      },
    });
    if (!renderer) {
      setMessage('This browser does not provide the WebGL2 renderer OpenFilm needs.');
      return;
    }
    rendererRef.current = renderer;
    const resize = () =>
      renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || photograph.sourceState === 'missing') {
      setMessage('The Source photograph is Missing. Refresh or relink it to continue.');
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setMessage('Reading Source photograph.');
    void onLoadSource(photograph.relativePath)
      .then(async (file) => {
        objectUrl = URL.createObjectURL(file);
        const dimensions = await readImageSize(objectUrl);
        if (cancelled) return;
        await renderer.replaceImage({ ...dimensions, objectUrl });
        if (!cancelled) setMessage('');
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setMessage(
            error instanceof Error
              ? error.message
              : 'OpenFilm could not show this Source photograph.',
          );
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [onLoadSource, photograph.relativePath, photograph.sourceState]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const edit = getLibraryEdit(photograph);
    renderer.setAdjustments(sourceView ? neutralRendererAdjustments : edit.adjustments);
    renderer.setGeometry(sourceView ? neutralGeometry : edit.geometry);
    renderer.setGrainSeed(edit.grainSeed);
  }, [photograph, sourceView]);

  return (
    <div
      className="library-photo-view"
      style={{ '--library-photo-zoom': zoomScale } as CSSProperties}
    >
      <canvas
        aria-label={`${photograph.fileName} ${sourceView ? 'Source view' : 'Rendered Edit'}`}
        ref={canvasRef}
      />
      {message ? (
        <p
          className="library-photo-view__message"
          role={message.includes('lost') ? 'alert' : 'status'}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
