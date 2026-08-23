import { adjustmentKeys, normalizeAdjustments, type AdjustmentValues } from '../editor/adjustments';
import {
  EDIT_HISTORY_LIMIT,
  type EditSnapshot,
  type PersistedEditHistory,
} from '../editor/editHistory';
import { isValidGeometry, normalizeGeometry } from '../editor/geometry';
import { isValidGrainSeed, type GrainSeed } from '../editor/grain';
import { LOOK_DESCRIPTION_MAX_LENGTH, LOOK_TITLE_MAX_LENGTH } from '../editor/looks';
import { isValidToneCurve } from '../editor/toneCurve';
import {
  SOURCE_PHOTOGRAPH_MIME_TYPES,
  type SourcePhotographMimeType,
} from '../import/sourcePhotograph';

export const storageNotice = 'Browser storage is for recovery, not a backup.';
export const storageUnavailableNotice =
  'Local recovery is unavailable here because this browser does not provide IndexedDB. Your Edit will remain in memory until this tab closes.';
export const storageFailureNotice =
  'Local recovery is unavailable here because browser storage failed. Your Edit will remain in memory until this tab closes. Try again or continue without recovery.';

export const STORAGE_DATABASE_NAME = 'openfilm';
export const STORAGE_DATABASE_VERSION = 2;
export const CUSTOM_LOOKS_STORE_NAME = 'custom-looks';
export const LATEST_EDIT_STORE_NAME = 'latest-edit';
export const SOURCE_PHOTOGRAPH_STORE_NAME = 'source-photograph';
export const LATEST_EDIT_KEY = 'current';

export interface StoredLook {
  adjustments: AdjustmentValues;
  createdAt: number;
  description: string;
  id: string;
  title: string;
  updatedAt: number;
}

export interface StoredSourcePhotograph {
  blob: Blob;
  fileName: string;
  height: number;
  mimeType: SourcePhotographMimeType;
  width: number;
}

export interface StoredEdit {
  grainSeed: GrainSeed | null;
  history: PersistedEditHistory;
  savedAt: number;
  source?: StoredSourcePhotograph | null;
  sourceFileName: string | null;
  version: 1;
}

export interface BrowserStorage {
  deleteCustomLook(id: string): Promise<void>;
  listCustomLooks(): Promise<StoredLook[]>;
  loadLatestEdit(): Promise<StoredEdit | null>;
  saveLatestEdit(edit: StoredEdit): Promise<void>;
  saveCustomLook(look: StoredLook): Promise<void>;
}

function getIndexedDb(): IDBFactory | undefined {
  return typeof globalThis.indexedDB !== 'undefined' ? globalThis.indexedDB : undefined;
}

export function hasBrowserStorage(): boolean {
  try {
    const indexedDb = getIndexedDb();
    return Boolean(indexedDb && typeof indexedDb.open === 'function');
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isValidStoredAdjustmentValues(value: unknown): value is AdjustmentValues {
  if (!isRecord(value) || !isValidToneCurve(value.toneCurve)) {
    return false;
  }

  return adjustmentKeys.every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
  );
}

function normalizeSnapshot(value: unknown): EditSnapshot | null {
  if (!isRecord(value) || !isValidStoredAdjustmentValues(value.adjustments)) {
    return null;
  }

  if (!isValidGeometry(value.geometry)) {
    return null;
  }

  return {
    adjustments: normalizeAdjustments(value.adjustments),
    geometry: normalizeGeometry(value.geometry),
  };
}

function normalizeHistory(value: unknown): PersistedEditHistory | null {
  if (!isRecord(value) || !Array.isArray(value.past) || !Array.isArray(value.future)) {
    return null;
  }

  const present = normalizeSnapshot(value.present);
  const past = value.past.map(normalizeSnapshot);
  const future = value.future.map(normalizeSnapshot);

  if (!present || past.some((snapshot) => !snapshot) || future.some((snapshot) => !snapshot)) {
    return null;
  }

  return {
    future: future
      .filter((snapshot): snapshot is EditSnapshot => snapshot !== null)
      .slice(0, EDIT_HISTORY_LIMIT),
    past: past
      .filter((snapshot): snapshot is EditSnapshot => snapshot !== null)
      .slice(-EDIT_HISTORY_LIMIT),
    present,
  };
}

function isSourcePhotographMimeType(value: unknown): value is SourcePhotographMimeType {
  return (
    typeof value === 'string' &&
    SOURCE_PHOTOGRAPH_MIME_TYPES.includes(value as SourcePhotographMimeType)
  );
}

function normalizeStoredSource(value: unknown): StoredSourcePhotograph | null {
  if (!isRecord(value) || !isBlob(value.blob)) {
    return null;
  }

  if (
    typeof value.fileName !== 'string' ||
    value.fileName.length === 0 ||
    !isSourcePhotographMimeType(value.mimeType) ||
    typeof value.width !== 'number' ||
    !Number.isInteger(value.width) ||
    value.width < 1 ||
    typeof value.height !== 'number' ||
    !Number.isInteger(value.height) ||
    value.height < 1
  ) {
    return null;
  }

  return {
    blob: value.blob,
    fileName: value.fileName,
    height: value.height,
    mimeType: value.mimeType,
    width: value.width,
  };
}

export function normalizeStoredLook(value: unknown): StoredLook | null {
  if (!isRecord(value) || !isValidStoredAdjustmentValues(value.adjustments)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.title !== 'string' ||
    value.title.trim().length === 0 ||
    value.title.length > LOOK_TITLE_MAX_LENGTH ||
    typeof value.description !== 'string' ||
    value.description.length > LOOK_DESCRIPTION_MAX_LENGTH ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt)
  ) {
    return null;
  }

  return {
    adjustments: normalizeAdjustments(value.adjustments),
    createdAt: value.createdAt,
    description: value.description,
    id: value.id,
    title: value.title,
    updatedAt: value.updatedAt,
  };
}

export function normalizeStoredEdit(value: unknown): StoredEdit | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  if (
    (value.grainSeed !== null && !isValidGrainSeed(value.grainSeed)) ||
    (value.sourceFileName !== null &&
      value.sourceFileName !== undefined &&
      typeof value.sourceFileName !== 'string') ||
    typeof value.savedAt !== 'number' ||
    !Number.isFinite(value.savedAt)
  ) {
    return null;
  }

  const history = normalizeHistory(value.history);

  if (!history) {
    return null;
  }

  let source: StoredSourcePhotograph | null = null;

  if (value.source !== null && value.source !== undefined) {
    source = normalizeStoredSource(value.source);

    if (!source) {
      return null;
    }
  }

  return {
    grainSeed: value.grainSeed,
    history,
    savedAt: value.savedAt,
    source,
    sourceFileName: value.sourceFileName === undefined ? null : value.sourceFileName,
    version: 1,
  };
}

function openDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;

    try {
      request = indexedDb.open(STORAGE_DATABASE_NAME, STORAGE_DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(CUSTOM_LOOKS_STORE_NAME)) {
        database.createObjectStore(CUSTOM_LOOKS_STORE_NAME, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(LATEST_EDIT_STORE_NAME)) {
        database.createObjectStore(LATEST_EDIT_STORE_NAME);
      }

      if (!database.objectStoreNames.contains(SOURCE_PHOTOGRAPH_STORE_NAME)) {
        database.createObjectStore(SOURCE_PHOTOGRAPH_STORE_NAME);
      }
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened.'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked by another browser tab.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onsuccess = () => resolve(request.result);
  });
}

function createIndexedDbStorage(indexedDb: IDBFactory): BrowserStorage {
  let databasePromise: Promise<IDBDatabase> | null = null;

  function database(): Promise<IDBDatabase> {
    databasePromise ??= openDatabase(indexedDb);
    return databasePromise;
  }

  async function requestFromStore<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const connection = await database();
    const transaction = connection.transaction(storeName, mode);
    return requestValue(operation(transaction.objectStore(storeName)));
  }

  async function readLatestEditRecord(): Promise<{ edit: unknown; source: unknown }> {
    const connection = await database();
    const transaction = connection.transaction(
      [LATEST_EDIT_STORE_NAME, SOURCE_PHOTOGRAPH_STORE_NAME],
      'readonly',
    );
    const editRequest = transaction.objectStore(LATEST_EDIT_STORE_NAME).get(LATEST_EDIT_KEY);
    const sourceRequest = transaction
      .objectStore(SOURCE_PHOTOGRAPH_STORE_NAME)
      .get(LATEST_EDIT_KEY);

    const [edit, source] = await Promise.all([
      requestValue(editRequest),
      requestValue(sourceRequest),
    ]);

    return { edit, source };
  }

  return {
    async deleteCustomLook(id) {
      await requestFromStore(CUSTOM_LOOKS_STORE_NAME, 'readwrite', (store) => store.delete(id));
    },
    async listCustomLooks() {
      const records = await requestFromStore<unknown[]>(
        CUSTOM_LOOKS_STORE_NAME,
        'readonly',
        (store) => store.getAll(),
      );

      return records
        .map(normalizeStoredLook)
        .filter((look): look is StoredLook => look !== null)
        .sort((first, second) => second.updatedAt - first.updatedAt);
    },
    async loadLatestEdit() {
      const { edit, source } = await readLatestEditRecord();

      if (edit === undefined) {
        return null;
      }

      const record = isRecord(edit) ? { ...edit, source: source ?? edit.source ?? null } : edit;

      return normalizeStoredEdit(record);
    },
    async saveCustomLook(look) {
      const normalized = normalizeStoredLook(look);

      if (!normalized) {
        throw new Error('OpenFilm could not save that Look.');
      }

      await requestFromStore(CUSTOM_LOOKS_STORE_NAME, 'readwrite', (store) =>
        store.put(normalized),
      );
    },
    async saveLatestEdit(edit) {
      const normalized = normalizeStoredEdit(edit);
      const hasSource = Object.prototype.hasOwnProperty.call(edit, 'source');

      if (!normalized) {
        throw new Error('OpenFilm could not save the latest Edit.');
      }

      if (hasSource) {
        if (normalized.source) {
          await requestFromStore(SOURCE_PHOTOGRAPH_STORE_NAME, 'readwrite', (store) =>
            store.put(normalized.source, LATEST_EDIT_KEY),
          );
        } else {
          await requestFromStore(SOURCE_PHOTOGRAPH_STORE_NAME, 'readwrite', (store) =>
            store.delete(LATEST_EDIT_KEY),
          );
        }
      }

      const editWithoutSource = { ...normalized };
      delete editWithoutSource.source;

      await requestFromStore(LATEST_EDIT_STORE_NAME, 'readwrite', (store) =>
        store.put(editWithoutSource, LATEST_EDIT_KEY),
      );
    },
  };
}

export function createBrowserStorage(indexedDb?: IDBFactory): BrowserStorage | null {
  try {
    const availableIndexedDb = indexedDb ?? getIndexedDb();

    return availableIndexedDb && typeof availableIndexedDb.open === 'function'
      ? createIndexedDbStorage(availableIndexedDb)
      : null;
  } catch {
    return null;
  }
}

export function createMemoryStorage(
  initial: {
    customLooks?: StoredLook[];
    latestEdit?: StoredEdit | null;
  } = {},
): BrowserStorage {
  let customLooks =
    initial.customLooks
      ?.map((look) => normalizeStoredLook(look))
      .filter((look): look is StoredLook => look !== null) ?? [];
  let latestEdit = initial.latestEdit ? normalizeStoredEdit(initial.latestEdit) : null;
  let storedSource = latestEdit?.source ?? null;

  return {
    async deleteCustomLook(id) {
      customLooks = customLooks.filter((look) => look.id !== id);
    },
    async listCustomLooks() {
      return customLooks
        .map((look) => ({ ...look, adjustments: normalizeAdjustments(look.adjustments) }))
        .sort((first, second) => second.updatedAt - first.updatedAt);
    },
    async loadLatestEdit() {
      return latestEdit ? { ...latestEdit, source: storedSource } : null;
    },
    async saveCustomLook(look) {
      const normalized = normalizeStoredLook(look);

      if (!normalized) {
        throw new Error('OpenFilm could not save that Look.');
      }

      customLooks = [...customLooks.filter((item) => item.id !== normalized.id), normalized];
    },
    async saveLatestEdit(edit) {
      latestEdit = normalizeStoredEdit(edit);

      if (!latestEdit) {
        throw new Error('OpenFilm could not save the latest Edit.');
      }

      if (Object.prototype.hasOwnProperty.call(edit, 'source')) {
        storedSource = latestEdit.source ?? null;
      }

      latestEdit = { ...latestEdit, source: storedSource };
    },
  };
}

export function describeStorageError(reason: 'failed' | 'unavailable' = 'failed'): string {
  return reason === 'unavailable' ? storageUnavailableNotice : storageFailureNotice;
}
