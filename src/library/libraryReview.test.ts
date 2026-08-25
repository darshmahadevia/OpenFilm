import { createEmptyLibraryDocument, type LibraryPhotographRecord } from './libraryModel';
import {
  applyLibraryReviewCommand,
  copyActiveLookToSelection,
  createLibraryReviewContext,
  filterLibraryPhotographs,
  getLibraryEdit,
  navigateLibraryReview,
  updateLibraryEdit,
} from './libraryReview';

function photograph(id: string, disposition: LibraryPhotographRecord['disposition'] = 'unmarked') {
  return {
    cameraSerial: null,
    captureTime: `2026-01-01T00:00:0${id}.000`,
    disposition,
    fileName: `${id}.jpg`,
    fingerprint: { byteSize: 10, lastModified: 1 },
    id,
    mimeType: 'image/jpeg' as const,
    orientation: null,
    rating: null,
    relativePath: `${id}.jpg`,
    sourceState: 'available' as const,
  };
}

function library(): ReturnType<typeof createEmptyLibraryDocument> {
  return {
    ...createEmptyLibraryDocument('Review'),
    photographs: [photograph('1'), photograph('2'), photograph('3')],
  };
}

describe('Library review commands', () => {
  it('keeps Active separate from Selection and extends keyboard range Selection', () => {
    const document = library();
    const context = createLibraryReviewContext(document.photographs);
    const next = navigateLibraryReview(context, document.photographs, 1, true);
    expect(next).toMatchObject({ activePhotographId: '2', selection: ['1', '2'] });
  });

  it('uses pre-command ordering to auto-advance when a filter hides the reviewed photograph', () => {
    const document = library();
    const context = {
      ...createLibraryReviewContext(document.photographs),
      filter: { disposition: 'unmarked' as const },
    };
    const result = applyLibraryReviewCommand(document, context, {
      kind: 'set-disposition',
      disposition: 'pick',
    });
    expect(result.context.activePhotographId).toBe('2');
    expect(result.context.scrollAnchorPhotographId).toBe('1');
    expect(
      filterLibraryPhotographs(result.document.photographs, context.filter).map((item) => item.id),
    ).toEqual(['2', '3']);
    expect(result.previous).toEqual({ context, document });
  });

  it('ends a filtered pass without wrapping', () => {
    const document = { ...library(), photographs: [photograph('1')] };
    const context = {
      ...createLibraryReviewContext(document.photographs),
      filter: { disposition: 'unmarked' as const },
    };
    const result = applyLibraryReviewCommand(document, context, {
      kind: 'set-disposition',
      disposition: 'reject',
    });
    expect(result.context.activePhotographId).toBeNull();
  });

  it('supports analysis-completion and unsupported-result filter states', () => {
    const document = library();
    document.photographs[0].analysis = { status: 'complete' };
    expect(filterLibraryPhotographs(document.photographs, { analysisComplete: true })).toHaveLength(
      1,
    );
    expect(filterLibraryPhotographs(document.photographs, { unsupportedOnly: true })).toEqual([]);
  });

  it('copies one Look to the complete Selection as one document change', () => {
    let document = library();
    document = updateLibraryEdit(document, '1', (edit) => ({
      ...edit,
      adjustments: { ...edit.adjustments, exposure: 1.25, saturation: -0.2 },
    }));
    const copied = copyActiveLookToSelection(document, '1', ['2', '3']);
    expect(getLibraryEdit(copied.photographs[1])).toMatchObject({
      adjustments: { exposure: 1.25, saturation: -0.2 },
      revision: 1,
    });
    expect(getLibraryEdit(copied.photographs[2]).adjustments.exposure).toBe(1.25);
    expect(document.photographs[1]).not.toHaveProperty('edit');
  });
});
