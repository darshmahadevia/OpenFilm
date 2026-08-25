import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdtemp, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';

const GITHUB_RELEASE_API = 'https://api.github.com/repos/darshmahadevia/OpenFilm/releases/latest';
const MAX_INSTALLER_BYTES = 1024 * 1024 * 1024;
const NETWORK_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1_000;

const UPDATE_CHANNELS = {
  check: 'openfilm:updates:check',
  download: 'openfilm:updates:download',
  getState: 'openfilm:updates:get-state',
  launch: 'openfilm:updates:launch',
  state: 'openfilm:updates:state',
};

const PLATFORM_ASSETS = {
  darwin: { name: 'OpenFilm.dmg', platform: 'mac' },
  win32: { name: 'OpenFilm-Setup.exe', platform: 'windows' },
};

function parseVersion(version) {
  const match = String(version)
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4]?.split('.') ?? [],
  };
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === undefined) return -1;
    if (right[index] === undefined) return 1;
    if (left[index] === right[index]) continue;
    const leftNumber = /^\d+$/.test(left[index]) ? Number(left[index]) : null;
    const rightNumber = /^\d+$/.test(right[index]) ? Number(right[index]) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber > rightNumber ? 1 : -1;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

export function isNewerVersion(candidate, current) {
  const candidateVersion = parseVersion(candidate);
  const currentVersion = parseVersion(current);
  if (!candidateVersion || !currentVersion) return false;
  for (let index = 0; index < candidateVersion.core.length; index += 1) {
    if (candidateVersion.core[index] === currentVersion.core[index]) continue;
    return candidateVersion.core[index] > currentVersion.core[index];
  }
  return comparePrerelease(candidateVersion.prerelease, currentVersion.prerelease) > 0;
}

function isAllowedAssetUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith('/darshmahadevia/OpenFilm/releases/download/')
    );
  } catch {
    return false;
  }
}

function isAllowedDownloadResponse(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      [
        'github.com',
        'objects.githubusercontent.com',
        'release-assets.githubusercontent.com',
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function parseDigest(value) {
  const match = typeof value === 'string' ? value.match(/^sha256:([a-f0-9]{64})$/i) : null;
  return match?.[1]?.toLowerCase() ?? null;
}

function safeErrorMessage(context) {
  if (context === 'check') {
    return 'OpenFilm could not check GitHub Releases. Check your connection and try again.';
  }
  if (context === 'download') {
    return 'OpenFilm could not download the installer. Check your connection and try again.';
  }
  return 'OpenFilm could not open the installer. Try again or open it from your temporary folder.';
}

function validReleaseAsset(asset, expectedName) {
  return (
    asset &&
    asset.name === expectedName &&
    Number.isSafeInteger(asset.size) &&
    asset.size > 0 &&
    asset.size <= MAX_INSTALLER_BYTES &&
    isAllowedAssetUrl(asset.browser_download_url)
  );
}

async function readLatestRelease(fetchImpl, expectedName) {
  const response = await fetchImpl(GITHUB_RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OpenFilm desktop updater',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: globalThis.AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GitHub Releases returned ${response.status}.`);
  const release = await response.json();
  const version = typeof release.tag_name === 'string' ? release.tag_name.replace(/^v/, '') : '';
  if (
    !parseVersion(version) ||
    release.draft ||
    release.prerelease ||
    !Array.isArray(release.assets)
  ) {
    throw new Error('GitHub Releases returned an invalid latest release.');
  }
  const asset = release.assets.find((candidate) => validReleaseAsset(candidate, expectedName));
  if (!asset) throw new Error(`The latest release does not include ${expectedName}.`);
  return {
    digest: parseDigest(asset.digest),
    name: expectedName,
    size: asset.size,
    url: asset.browser_download_url,
    version,
  };
}

async function downloadAsset({ asset, destination, fetchImpl, onProgress }) {
  const response = await fetchImpl(asset.url, {
    headers: { 'User-Agent': 'OpenFilm desktop updater' },
    signal: globalThis.AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok || !response.body || !isAllowedDownloadResponse(response.url)) {
    throw new Error('GitHub returned an invalid installer download.');
  }

  const file = await open(destination, 'wx', 0o600);
  const hash = createHash('sha256');
  let received = 0;
  try {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk);
      received += bytes.byteLength;
      if (received > asset.size || received > MAX_INSTALLER_BYTES) {
        throw new Error('The installer exceeded its expected size.');
      }
      hash.update(bytes);
      let offset = 0;
      while (offset < bytes.byteLength) {
        const { bytesWritten } = await file.write(bytes, offset, bytes.byteLength - offset, null);
        if (bytesWritten === 0) throw new Error('The installer could not be written to disk.');
        offset += bytesWritten;
      }
      onProgress((received / asset.size) * 100);
    }
  } finally {
    await file.close();
  }

  if (received !== asset.size) throw new Error('The installer download was incomplete.');
  if (asset.digest && hash.digest('hex') !== asset.digest) {
    throw new Error('The installer checksum did not match GitHub Releases.');
  }
}

export function registerUpdater({ app, fetchImpl, ipcMain, openPath, platform, sendToRenderers }) {
  const platformAsset = PLATFORM_ASSETS[platform];
  let latestAsset = null;
  let downloadedPath = null;
  let downloadDirectory = null;
  let state = {
    currentVersion: app.getVersion(),
    phase: 'idle',
    platform: platformAsset?.platform ?? 'unsupported',
  };

  function publish(update) {
    state = { ...state, ...update };
    sendToRenderers(UPDATE_CHANNELS.state, state);
    return state;
  }

  async function check() {
    if (!app.isPackaged || !platformAsset) {
      return publish({
        message: app.isPackaged ? 'Updates are available on macOS and Windows.' : undefined,
        phase: 'up-to-date',
      });
    }
    if (
      ['checking', 'downloading', 'ready', 'opened'].includes(state.phase) ||
      (state.phase === 'error' && state.errorContext !== 'check')
    ) {
      return state;
    }
    publish({ errorContext: undefined, message: undefined, phase: 'checking' });
    try {
      const release = await readLatestRelease(fetchImpl, platformAsset.name);
      if (!isNewerVersion(release.version, state.currentVersion)) {
        latestAsset = null;
        return publish({
          errorContext: undefined,
          message: undefined,
          percent: undefined,
          phase: 'up-to-date',
          version: undefined,
        });
      }
      latestAsset = release;
      return publish({
        errorContext: undefined,
        message: undefined,
        percent: undefined,
        phase: 'available',
        version: release.version,
      });
    } catch {
      latestAsset = null;
      return publish({
        errorContext: 'check',
        message: safeErrorMessage('check'),
        percent: undefined,
        phase: 'error',
      });
    }
  }

  async function download() {
    const canRetryDownload = state.phase === 'error' && state.errorContext === 'download';
    if (!latestAsset || (state.phase !== 'available' && !canRetryDownload)) return state;
    publish({ errorContext: undefined, message: undefined, percent: 0, phase: 'downloading' });
    let lastPublishedPercent = -1;
    try {
      downloadDirectory = await mkdtemp(path.join(app.getPath('temp'), 'openfilm-update-'));
      downloadedPath = path.join(downloadDirectory, latestAsset.name);
      await downloadAsset({
        asset: latestAsset,
        destination: downloadedPath,
        fetchImpl,
        onProgress(percent) {
          const rounded = Math.min(100, Math.max(0, Math.round(percent)));
          if (rounded !== lastPublishedPercent) {
            lastPublishedPercent = rounded;
            publish({ percent: rounded, phase: 'downloading' });
          }
        },
      });
      return publish({
        errorContext: undefined,
        message: undefined,
        percent: 100,
        phase: 'ready',
      });
    } catch {
      downloadedPath = null;
      if (downloadDirectory) await rm(downloadDirectory, { force: true, recursive: true });
      downloadDirectory = null;
      return publish({
        errorContext: 'download',
        message: safeErrorMessage('download'),
        percent: undefined,
        phase: 'error',
      });
    }
  }

  async function launch() {
    const canRetryLaunch = state.phase === 'error' && state.errorContext === 'launch';
    if (!downloadedPath || (!['ready', 'opened'].includes(state.phase) && !canRetryLaunch)) {
      return false;
    }
    try {
      const error = await openPath(downloadedPath);
      if (error) throw new Error(error);
      publish({ errorContext: undefined, message: undefined, phase: 'opened' });
      return true;
    } catch {
      publish({ errorContext: 'launch', message: safeErrorMessage('launch'), phase: 'error' });
      return false;
    }
  }

  ipcMain.handle(UPDATE_CHANNELS.getState, () => state);
  ipcMain.handle(UPDATE_CHANNELS.check, check);
  ipcMain.handle(UPDATE_CHANNELS.download, download);
  ipcMain.handle(UPDATE_CHANNELS.launch, launch);

  return {
    check,
    schedule() {
      if (!app.isPackaged || !platformAsset) return () => {};
      const initial = globalThis.setTimeout(() => void check(), 8_000);
      const interval = globalThis.setInterval(() => void check(), 4 * 60 * 60 * 1_000);
      initial.unref();
      interval.unref();
      return () => {
        globalThis.clearTimeout(initial);
        globalThis.clearInterval(interval);
      };
    },
  };
}
