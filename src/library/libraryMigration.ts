import {
  normalizeStoredEdit,
  normalizeStoredLook,
  type StoredEdit,
  type StoredLook,
} from '../storage/browserStorage';

export type LegacyMigrationAction = 'discard' | 'export-edit' | 'import-looks';

export interface LegacyMigrationState {
  errors: string[];
  fingerprint: string;
  kind: 'action-required' | 'clean' | 'resolved';
  looks: StoredLook[];
  quarantinedEdit: StoredEdit | null;
}

function stableFingerprint(value: unknown): string {
  const serialized = JSON.stringify(value) ?? '';
  let hash = 2_166_136_261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function inspectLegacyState(
  rawLooks: readonly unknown[],
  rawEdit: unknown,
  resolvedFingerprint: string | null,
): LegacyMigrationState {
  const looks: StoredLook[] = [];
  const errors: string[] = [];
  for (const value of rawLooks) {
    const look = normalizeStoredLook(value);
    if (look) looks.push(look);
    else errors.push('OpenFilm found a malformed v1 Look and left it quarantined.');
  }
  const quarantinedEdit =
    rawEdit === null || rawEdit === undefined ? null : normalizeStoredEdit(rawEdit);
  if (rawEdit !== null && rawEdit !== undefined && !quarantinedEdit) {
    errors.push('OpenFilm found an unsupported or partial v1 Edit and left it quarantined.');
  }
  const fingerprint = stableFingerprint({ rawEdit, rawLooks });
  const hasState = rawLooks.length > 0 || (rawEdit !== null && rawEdit !== undefined);
  return {
    errors,
    fingerprint,
    kind: !hasState
      ? 'clean'
      : resolvedFingerprint === fingerprint
        ? 'resolved'
        : 'action-required',
    looks,
    quarantinedEdit,
  };
}

export function resolveLegacyMigration(
  state: LegacyMigrationState,
  action: LegacyMigrationAction,
): { action: LegacyMigrationAction; fingerprint: string; resolved: true } {
  if (state.kind !== 'action-required') throw new Error('There is no unresolved v1 state.');
  return { action, fingerprint: state.fingerprint, resolved: true };
}
