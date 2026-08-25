import { createEmptyLibraryDocument, type LibraryPhotographRecord } from './libraryModel';
import {
  acceptReviewProposal,
  dismissReviewProposal,
  dissolveReviewGroup,
  getReviewGroups,
  mergeReviewGroups,
  proposeBurstGroups,
  splitReviewGroup,
  toggleReviewGroup,
} from './libraryReviewGroups';

function photo(id: string, serial: string | null, time: string | null): LibraryPhotographRecord {
  return {
    cameraSerial: serial,
    captureTime: time,
    disposition: 'unmarked',
    fileName: `${id}.jpg`,
    fingerprint: { byteSize: 10, lastModified: 1 },
    id,
    mimeType: 'image/jpeg',
    orientation: null,
    rating: null,
    relativePath: `${id}.jpg`,
    sourceState: 'available',
  };
}

describe('Review groups', () => {
  it('proposes only consecutive same-camera photographs within the two-second boundary', () => {
    const photographs = [
      photo('1', ' AB-12 ', '2026-01-01T10:00:00.000'),
      photo('2', 'ab12', '2026-01-01T10:00:02.000'),
      photo('3', 'ab12', '2026-01-01T10:00:04.001'),
      photo('4', null, '2026-01-01T10:00:05.000'),
      photo('5', 'ab12', null),
    ];
    expect(proposeBurstGroups(photographs)).toMatchObject([
      { kind: 'burst', photographIds: ['1', '2'] },
    ]);
  });

  it('requires acceptance, remembers dismissal, and never overlaps an accepted group', () => {
    const document = {
      ...createEmptyLibraryDocument('Groups'),
      photographs: [photo('1', 'a', '2026-01-01T00:00:00'), photo('2', 'a', '2026-01-01T00:00:01')],
    };
    const proposal = proposeBurstGroups(document.photographs)[0];
    const accepted = acceptReviewProposal(document, proposal);
    expect(getReviewGroups(accepted)).toMatchObject([
      { origin: 'burst', photographIds: ['1', '2'] },
    ]);
    expect(() => acceptReviewProposal(accepted, { ...proposal, id: 'other' })).toThrow(
      /already belongs/,
    );

    const dismissed = dismissReviewProposal(document, proposal.id);
    expect(proposeBurstGroups(dismissed.photographs, dismissed)).toEqual([]);
  });

  it('marks merge, split, and dissolve membership changes as Manual', () => {
    const base = {
      ...createEmptyLibraryDocument('Groups'),
      photographs: [
        photo('1', 'a', '2026-01-01T00:00:00'),
        photo('2', 'a', '2026-01-01T00:00:01'),
        photo('3', 'b', '2026-01-01T00:00:10'),
        photo('4', 'b', '2026-01-01T00:00:11'),
      ],
    };
    let document = acceptReviewProposal(base, proposeBurstGroups(base.photographs)[0]);
    document = acceptReviewProposal(document, proposeBurstGroups(base.photographs)[1]);
    const [first, second] = getReviewGroups(document);
    document = mergeReviewGroups(document, first.id, second.id);
    expect(getReviewGroups(document)).toMatchObject([
      { origin: 'manual', photographIds: ['1', '2', '3', '4'] },
    ]);
    const merged = getReviewGroups(document)[0];
    document = splitReviewGroup(document, merged.id, 2);
    expect(getReviewGroups(document)).toMatchObject([
      { origin: 'manual', photographIds: ['1', '2'] },
      { origin: 'manual', photographIds: ['3', '4'] },
    ]);
    document = dissolveReviewGroup(document, getReviewGroups(document)[0].id);
    expect(getReviewGroups(document)).toHaveLength(1);
  });

  it('keeps provenance when only expansion changes', () => {
    const document = {
      ...createEmptyLibraryDocument('Groups'),
      photographs: [photo('1', 'a', '2026-01-01T00:00:00'), photo('2', 'a', '2026-01-01T00:00:01')],
    };
    const accepted = acceptReviewProposal(document, proposeBurstGroups(document.photographs)[0]);
    const group = getReviewGroups(accepted)[0];
    expect(getReviewGroups(toggleReviewGroup(accepted, group.id))[0]).toMatchObject({
      expanded: false,
      origin: 'burst',
    });
  });
});
