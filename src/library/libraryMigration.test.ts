import { neutralAdjustments } from '../editor/adjustments';
import { createEditHistory } from '../editor/editHistory';
import { inspectLegacyState, resolveLegacyMigration } from './libraryMigration';

describe('v1 migration', () => {
  it('keeps valid Looks and quarantines a recoverable Edit until an explicit resolution', () => {
    const look = {
      adjustments: neutralAdjustments,
      createdAt: 1,
      description: '',
      id: 'look-1',
      title: 'Portra',
      updatedAt: 1,
    };
    const edit = {
      grainSeed: 10,
      history: createEditHistory(),
      savedAt: 2,
      sourceFileName: 'frame.jpg',
      version: 1 as const,
    };
    const migration = inspectLegacyState([look], edit, null);
    expect(migration).toMatchObject({
      kind: 'action-required',
      looks: [{ title: 'Portra' }],
      quarantinedEdit: { savedAt: 2, sourceFileName: 'frame.jpg', version: 1 },
    });
    expect(resolveLegacyMigration(migration, 'export-edit')).toMatchObject({
      action: 'export-edit',
      resolved: true,
    });
  });

  it('reports malformed partial state and stays dismissed for the same fingerprint', () => {
    const malformed = inspectLegacyState([{ title: 'broken' }], { version: 99 }, null);
    expect(malformed.kind).toBe('action-required');
    expect(malformed.errors).toHaveLength(2);
    expect(
      inspectLegacyState([{ title: 'broken' }], { version: 99 }, malformed.fingerprint).kind,
    ).toBe('resolved');
  });

  it('does not invent a migration on a clean upgrade', () => {
    expect(inspectLegacyState([], null, null).kind).toBe('clean');
  });
});
