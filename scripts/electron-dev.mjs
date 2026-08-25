import { spawn } from 'node:child_process';
import process from 'node:process';

const host = '127.0.0.1';
const port = 5173;
const developmentUrl = `http://${host}:${port}`;

const vite = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port)], {
  env: process.env,
  stdio: 'inherit',
});

async function waitForVite() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await globalThis.fetch(`${developmentUrl}/app.html`);
      if (response.ok) return;
    } catch {
      // Vite has not opened the port yet.
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 250));
  }
  throw new Error('Vite did not start within 20 seconds.');
}

let electron;

function stop(exitCode = 0) {
  electron?.kill('SIGTERM');
  vite.kill('SIGTERM');
  process.exitCode = exitCode;
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

try {
  await waitForVite();
  electron = spawn('electron', ['.'], {
    env: { ...process.env, OPENFILM_DEV_SERVER_URL: developmentUrl },
    stdio: 'inherit',
  });
  electron.on('exit', (code) => stop(code ?? 0));
  vite.on('exit', (code) => {
    if (code && code !== 0) stop(code);
  });
} catch (error) {
  globalThis.console.error(error instanceof Error ? error.message : error);
  stop(1);
}
