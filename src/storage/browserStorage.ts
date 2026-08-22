export const storageNotice = 'Browser storage is for recovery, not a backup.';

export function hasBrowserStorage(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage !== null;
  } catch {
    return false;
  }
}
