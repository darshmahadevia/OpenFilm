import type { JsonValue } from './libraryFile';
import {
  cloneOpenFilmLibraryDocument,
  type LibraryPhotographRecord,
  type OpenFilmLibraryDocument,
} from './libraryModel';

export type ReviewGroupOrigin = 'burst' | 'manual' | 'similarity';

export interface ReviewGroupProposal {
  id: string;
  kind: 'burst' | 'similarity';
  photographIds: string[];
}

export interface ReviewGroup {
  expanded: boolean;
  id: string;
  origin: ReviewGroupOrigin;
  photographIds: string[];
  provenance: Array<'burst' | 'similarity'>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeCameraSerial(value: string | null): string | null {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  return normalized.length > 0 ? normalized : null;
}

function captureMilliseconds(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function proposalId(kind: ReviewGroupProposal['kind'], ids: readonly string[]): string {
  return `${kind}:${ids.join(':')}`;
}

function resolvedProposalIds(document?: OpenFilmLibraryDocument): Set<string> {
  if (!document) return new Set();
  return new Set([
    ...stringArray(document.dismissedReviewProposalIds),
    ...stringArray(document.acceptedReviewProposalIds),
  ]);
}

export function proposeBurstGroups(
  photographs: readonly LibraryPhotographRecord[],
  document?: OpenFilmLibraryDocument,
): ReviewGroupProposal[] {
  const resolved = resolvedProposalIds(document);
  const proposals: ReviewGroupProposal[] = [];
  let current: string[] = [];
  let currentSerial: string | null = null;
  let previousTime: number | null = null;

  const flush = () => {
    if (current.length > 1) {
      const proposal = {
        id: proposalId('burst', current),
        kind: 'burst' as const,
        photographIds: [...current],
      };
      if (!resolved.has(proposal.id)) proposals.push(proposal);
    }
    current = [];
    currentSerial = null;
    previousTime = null;
  };

  for (const photograph of photographs) {
    const serial = normalizeCameraSerial(photograph.cameraSerial);
    const time = captureMilliseconds(photograph.captureTime);
    if (!serial || time === null) {
      flush();
      continue;
    }
    if (
      current.length > 0 &&
      (serial !== currentSerial ||
        previousTime === null ||
        time - previousTime > 2_000 ||
        time < previousTime)
    ) {
      flush();
    }
    current.push(photograph.id);
    currentSerial = serial;
    previousTime = time;
  }
  flush();
  return proposals;
}

export function getReviewGroups(document: OpenFilmLibraryDocument): ReviewGroup[] {
  if (!Array.isArray(document.reviewGroups)) return [];
  return document.reviewGroups.flatMap((value) => {
    if (!isRecord(value) || typeof value.id !== 'string') return [];
    const origin = value.origin;
    if (origin !== 'burst' && origin !== 'manual' && origin !== 'similarity') return [];
    const provenance = stringArray(value.provenance).filter(
      (item): item is 'burst' | 'similarity' => item === 'burst' || item === 'similarity',
    );
    return [
      {
        expanded: value.expanded !== false,
        id: value.id,
        origin,
        photographIds: stringArray(value.photographIds),
        provenance,
      },
    ];
  });
}

function setGroups(
  document: OpenFilmLibraryDocument,
  groups: readonly ReviewGroup[],
): OpenFilmLibraryDocument {
  const next = cloneOpenFilmLibraryDocument(document);
  next.reviewGroups = JSON.parse(JSON.stringify(groups)) as JsonValue;
  return next;
}

export function dismissReviewProposal(
  document: OpenFilmLibraryDocument,
  proposalIdValue: string,
): OpenFilmLibraryDocument {
  const next = cloneOpenFilmLibraryDocument(document);
  next.dismissedReviewProposalIds = Array.from(
    new Set([...stringArray(document.dismissedReviewProposalIds), proposalIdValue]),
  );
  return next;
}

export function acceptReviewProposal(
  document: OpenFilmLibraryDocument,
  proposal: ReviewGroupProposal,
): OpenFilmLibraryDocument {
  const groups = getReviewGroups(document);
  const occupied = new Set(groups.flatMap((group) => group.photographIds));
  if (proposal.photographIds.some((id) => occupied.has(id))) {
    throw new Error('A photograph in this proposal already belongs to a Review group.');
  }
  const next = setGroups(document, [
    ...groups,
    {
      expanded: true,
      id: `group:${proposal.id}`,
      origin: proposal.kind,
      photographIds: [...proposal.photographIds],
      provenance: [proposal.kind],
    },
  ]);
  next.acceptedReviewProposalIds = Array.from(
    new Set([...stringArray(document.acceptedReviewProposalIds), proposal.id]),
  );
  return next;
}

export function mergeReviewGroups(
  document: OpenFilmLibraryDocument,
  firstId: string,
  secondId: string,
): OpenFilmLibraryDocument {
  const groups = getReviewGroups(document);
  const first = groups.find((group) => group.id === firstId);
  const second = groups.find((group) => group.id === secondId);
  if (!first || !second || first.id === second.id)
    throw new Error('Choose two Review groups to merge.');
  const merged: ReviewGroup = {
    expanded: true,
    id: `group:manual:${first.photographIds[0]}:${second.photographIds.at(-1)}`,
    origin: 'manual',
    photographIds: Array.from(new Set([...first.photographIds, ...second.photographIds])),
    provenance: Array.from(new Set([...first.provenance, ...second.provenance])),
  };
  return setGroups(document, [
    ...groups.filter((group) => group.id !== first.id && group.id !== second.id),
    merged,
  ]);
}

export function splitReviewGroup(
  document: OpenFilmLibraryDocument,
  groupId: string,
  splitIndex: number,
): OpenFilmLibraryDocument {
  const groups = getReviewGroups(document);
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group || splitIndex < 1 || splitIndex >= group.photographIds.length) {
    throw new Error('Choose a split point inside the Review group.');
  }
  const parts = [group.photographIds.slice(0, splitIndex), group.photographIds.slice(splitIndex)];
  return setGroups(document, [
    ...groups.filter((candidate) => candidate.id !== groupId),
    ...parts.map((photographIds, index): ReviewGroup => ({
      expanded: true,
      id: `${group.id}:manual:${index + 1}`,
      origin: 'manual',
      photographIds,
      provenance: group.provenance,
    })),
  ]);
}

export function dissolveReviewGroup(
  document: OpenFilmLibraryDocument,
  groupId: string,
): OpenFilmLibraryDocument {
  return setGroups(
    document,
    getReviewGroups(document).filter((group) => group.id !== groupId),
  );
}

export function toggleReviewGroup(
  document: OpenFilmLibraryDocument,
  groupId: string,
): OpenFilmLibraryDocument {
  return setGroups(
    document,
    getReviewGroups(document).map((group) =>
      group.id === groupId ? { ...group, expanded: !group.expanded } : group,
    ),
  );
}
