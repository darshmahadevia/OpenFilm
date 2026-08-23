import { createEditHistory } from '../editor/editHistory';
import { neutralAdjustments } from '../editor/adjustments';
import {
  createBrowserStorage,
  createMemoryStorage,
  describeStorageError,
  normalizeStoredEdit,
  type StoredEdit,
  type StoredLook,
} from './browserStorage';

const firstLook: StoredLook = {
  adjustments: { ...neutralAdjustments, exposure: 0.5 },
  createdAt: 1,
  description: 'A saved starting point.',
  id: 'first',
  title: 'First Look',
  updatedAt: 1,
};

function createStoredEdit(source: StoredEdit['source'] = null): StoredEdit {
  return {
    grainSeed: 9876,
    history: {
      future: [],
      past: [],
      present: createEditHistory({ adjustments: { saturation: 35 } }).present,
    },
    savedAt: 1,
    source,
    sourceFileName: 'missing-source.jpg',
    version: 1,
  };
}

describe('browser storage', () => {
  it('uses an in-memory session adapter when persistent storage is unavailable', async () => {
    const storage = createMemoryStorage({ customLooks: [firstLook] });

    expect(await storage.listCustomLooks()).toEqual([firstLook]);

    const renamed = { ...firstLook, title: 'Renamed Look', updatedAt: 2 };
    await storage.saveCustomLook(renamed);
    expect((await storage.listCustomLooks())[0].title).toBe('Renamed Look');

    await storage.deleteCustomLook(firstLook.id);
    expect(await storage.listCustomLooks()).toEqual([]);

    const edit = createStoredEdit();
    await storage.saveLatestEdit(edit);
    expect(await storage.loadLatestEdit()).toMatchObject({
      grainSeed: 9876,
      source: null,
      sourceFileName: 'missing-source.jpg',
    });
  });

  it('normalizes a valid recovery record and rejects malformed records', () => {
    const edit = createStoredEdit();

    expect(normalizeStoredEdit(edit)).toMatchObject({
      source: null,
      sourceFileName: 'missing-source.jpg',
    });
    expect(normalizeStoredEdit({ ...edit, version: 2 })).toBeNull();
    expect(normalizeStoredEdit({ ...edit, history: { present: {} } })).toBeNull();
  });

  it('explains that a failed storage adapter does not end the editing session', () => {
    expect(describeStorageError('failed')).toContain('browser storage failed');
    expect(describeStorageError('unavailable')).toContain('does not provide IndexedDB');
    expect(describeStorageError()).toContain('remain in memory');
    expect(createBrowserStorage(undefined)).toBeNull();
  });
});
