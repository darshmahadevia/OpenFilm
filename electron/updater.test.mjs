import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isNewerVersion, registerUpdater } from './updater.mjs';

const installer = Buffer.from('openfilm installer fixture');
const releaseUrl =
  'https://github.com/darshmahadevia/OpenFilm/releases/download/v0.3.0/OpenFilm.dmg';
const downloadedUrl =
  'https://release-assets.githubusercontent.com/github-production-release-asset/openfilm';
const temporaryDirectories = [];

function responseWithUrl(body, init, url) {
  return {
    body: [body],
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    url,
  };
}

function jsonResponse(body, status = 200) {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  };
}

function setup({ packaged = true, platform = 'darwin' } = {}) {
  const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'openfilm-updater-test-'));
  temporaryDirectories.push(temporaryDirectory);
  const assetName = platform === 'win32' ? 'OpenFilm-Setup.exe' : 'OpenFilm.dmg';
  const assetUrl = releaseUrl.replace('OpenFilm.dmg', assetName);
  const fetchImpl = vi.fn(async (url) => {
    if (url === assetUrl) {
      return responseWithUrl(installer, { status: 200 }, downloadedUrl);
    }
    return jsonResponse({
      assets: [
        {
          browser_download_url: assetUrl,
          digest: `sha256:${createHash('sha256').update(installer).digest('hex')}`,
          name: assetName,
          size: installer.byteLength,
        },
      ],
      draft: false,
      prerelease: false,
      tag_name: 'v0.3.0',
    });
  });
  const handlers = new Map();
  const openPath = vi.fn(async () => '');
  const sendToRenderers = vi.fn();
  const controller = registerUpdater({
    app: {
      getPath: () => temporaryDirectory,
      getVersion: () => '0.2.0',
      isPackaged: packaged,
    },
    fetchImpl,
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    openPath,
    platform,
    sendToRenderers,
  });
  return { controller, fetchImpl, handlers, openPath, sendToRenderers };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('desktop updater controller', () => {
  it('checks GitHub without downloading until the user asks', async () => {
    const { controller, fetchImpl, handlers } = setup();

    const available = await controller.check();
    expect(available).toMatchObject({ phase: 'available', version: '0.3.0' });
    expect(fetchImpl).toHaveBeenCalledOnce();

    const downloaded = await handlers.get('openfilm:updates:download')();
    expect(downloaded).toMatchObject({ percent: 100, phase: 'ready' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['darwin', 'OpenFilm.dmg'],
    ['win32', 'OpenFilm-Setup.exe'],
  ])('downloads and opens the expected %s installer', async (platform, assetName) => {
    const { controller, handlers, openPath } = setup({ platform });

    await controller.check();
    await handlers.get('openfilm:updates:download')();
    expect(await handlers.get('openfilm:updates:launch')()).toBe(true);
    const downloadedPath = openPath.mock.calls[0][0];
    expect(downloadedPath).toMatch(new RegExp(`${assetName.replace('.', '\\.')}$$`));
    expect(readFileSync(downloadedPath)).toEqual(installer);
  });

  it('reports streamed download progress to the renderer', async () => {
    const { controller, handlers, sendToRenderers } = setup();

    await controller.check();
    await handlers.get('openfilm:updates:download')();
    expect(sendToRenderers).toHaveBeenCalledWith(
      'openfilm:updates:state',
      expect.objectContaining({ percent: 100, phase: 'downloading' }),
    );
  });

  it('does not expose network or filesystem details in errors', async () => {
    const { controller, fetchImpl, handlers } = setup();
    fetchImpl.mockRejectedValueOnce(new Error('/private/app/path contained a secret header'));

    await controller.check();
    const state = await handlers.get('openfilm:updates:get-state')();
    expect(state).toMatchObject({
      errorContext: 'check',
      message: 'OpenFilm could not check GitHub Releases. Check your connection and try again.',
      phase: 'error',
    });
  });

  it('rejects release assets outside the pinned GitHub repository', async () => {
    const { controller, fetchImpl } = setup();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        assets: [
          {
            browser_download_url: 'https://example.com/OpenFilm.dmg',
            name: 'OpenFilm.dmg',
            size: installer.byteLength,
          },
        ],
        draft: false,
        prerelease: false,
        tag_name: 'v0.3.0',
      }),
    );

    expect(await controller.check()).toMatchObject({ errorContext: 'check', phase: 'error' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('deletes an installer whose GitHub checksum does not match', async () => {
    const { controller, fetchImpl, handlers, openPath } = setup();
    await controller.check();
    fetchImpl.mockResolvedValueOnce(
      responseWithUrl(Buffer.alloc(installer.byteLength), { status: 200 }, downloadedUrl),
    );

    const state = await handlers.get('openfilm:updates:download')();
    expect(state).toMatchObject({ errorContext: 'download', phase: 'error' });
    expect(await handlers.get('openfilm:updates:launch')()).toBe(false);
    expect(openPath).not.toHaveBeenCalled();
  });

  it('does not contact GitHub in development', async () => {
    const { controller, fetchImpl } = setup({ packaged: false });

    const state = await controller.check();
    expect(state.phase).toBe('up-to-date');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('version comparison', () => {
  it.each([
    ['0.3.0', '0.2.0', true],
    ['v1.0.0', '0.9.9', true],
    ['0.2.0', '0.2.0', false],
    ['0.1.9', '0.2.0', false],
    ['1.0.0', '1.0.0-beta.2', true],
    ['invalid', '0.2.0', false],
  ])('compares %s with %s', (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });
});
