import { createBrowserLibraryFileStore, type LibraryFileStore } from './libraryFileStore';
import { canonicalizeJson } from './libraryFile';
import {
  createBrowserLibraryLock,
  LibraryFileCoordinator,
  LIBRARY_COMMIT_PHASES,
  type LibraryCommitPhase,
} from './libraryFilePersistence';
import type { LibraryDocument } from './libraryFile';

export interface DurabilityHarnessCase {
  phase: LibraryCommitPhase;
  recoveredRevision: number | null;
  recoveredStatus: string;
  passed: boolean;
  resultStatus: string;
}

export interface DurabilityHarnessReport {
  cases: DurabilityHarnessCase[];
  failure: string | null;
  passed: boolean;
  phaseCount: number;
  store: 'origin-private-file-system';
}

const firstLibrary: LibraryDocument = {
  libraryId: 'browser-harness-library',
  photographs: [{ disposition: 'unmarked', id: 'photo-1', rating: null }],
  rootName: 'Browser durability harness',
};

const secondLibrary: LibraryDocument = {
  ...firstLibrary,
  photographs: [{ disposition: 'pick', id: 'photo-1', rating: 5 }],
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function runPhase(
  parent: FileSystemDirectoryHandle,
  phase: LibraryCommitPhase,
  index: number,
): Promise<DurabilityHarnessCase> {
  const directoryName = `openfilm-durability-${Date.now()}-${index}`;
  const root = await parent.getDirectoryHandle(directoryName, { create: true });
  const store: LibraryFileStore = createBrowserLibraryFileStore(root);
  const lockName = `openfilm-browser-durability-${index}`;
  const initialLock = createBrowserLibraryLock(lockName);
  const interruptedLock = createBrowserLibraryLock(lockName);

  try {
    assert(initialLock && interruptedLock, 'Chromium Web Locks is unavailable.');

    const initial = await new LibraryFileCoordinator(store, {
      lock: initialLock,
      now: () => 100,
    }).commit(firstLibrary, null);
    assert(initial.status === 'saved', `Initial revision did not save: ${initial.status}.`);

    const interrupted = await new LibraryFileCoordinator(store, {
      interruptAt: phase,
      lock: interruptedLock,
      now: () => 200,
    }).commit(secondLibrary, {
      checksum: initial.checksum,
      revision: initial.revision,
    });
    assert(interrupted.status === 'interrupted', `Phase ${phase} did not interrupt.`);

    const recovered = await new LibraryFileCoordinator(store, {
      lock: createBrowserLibraryLock(lockName),
    }).load();
    assert(recovered.status !== 'corrupt', `Phase ${phase} left no verified revision.`);
    assert(recovered.status !== 'conflict', `Phase ${phase} created a competing revision.`);
    assert(recovered.revision !== null, `Phase ${phase} recovered no revision.`);
    assert(
      canonicalizeJson(recovered.revision.library) === canonicalizeJson(firstLibrary) ||
        canonicalizeJson(recovered.revision.library) === canonicalizeJson(secondLibrary),
      `Phase ${phase} recovered a payload that was not one of the committed revisions.`,
    );

    return {
      passed: true,
      phase,
      recoveredRevision: recovered.revision.revision,
      recoveredStatus: recovered.status,
      resultStatus: interrupted.status,
    };
  } finally {
    try {
      await parent.removeEntry(directoryName, { recursive: true });
    } catch {
      // The harness result should report the commit outcome even if cleanup is unavailable.
    }
  }
}

export async function runDurabilityBrowserHarness(): Promise<DurabilityHarnessReport> {
  const cases: DurabilityHarnessCase[] = [];

  try {
    const storage = globalThis.navigator?.storage;
    assert(storage?.getDirectory, 'Chromium Origin Private File System is unavailable.');
    const parent = await storage.getDirectory();

    for (const [index, phase] of LIBRARY_COMMIT_PHASES.entries()) {
      try {
        cases.push(await runPhase(parent, phase, index));
      } catch (error) {
        cases.push({
          passed: false,
          phase,
          recoveredRevision: null,
          recoveredStatus: 'error',
          resultStatus: error instanceof Error ? error.message : 'unknown error',
        });
      }
    }

    const failedCase = cases.find((testCase) => !testCase.passed);

    return {
      cases,
      failure: failedCase ? `${failedCase.phase}: ${failedCase.resultStatus}` : null,
      passed: cases.length === LIBRARY_COMMIT_PHASES.length && !failedCase,
      phaseCount: LIBRARY_COMMIT_PHASES.length,
      store: 'origin-private-file-system',
    };
  } catch (error) {
    return {
      cases,
      failure: error instanceof Error ? error.message : 'Browser durability harness failed.',
      passed: false,
      phaseCount: LIBRARY_COMMIT_PHASES.length,
      store: 'origin-private-file-system',
    };
  }
}
