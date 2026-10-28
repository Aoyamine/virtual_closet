import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/@mediapipe/face_mesh');
const target = resolve(root, 'public/mediapipe');
await mkdir(target, { recursive: true });
for (const name of await readdir(source)) {
  if (/\.(wasm|data|binarypb|js)$/.test(name)) {
    await copyFile(resolve(source, name), resolve(target, name));
  }
}
console.log('Face tracking models prepared locally; camera frames stay on this device.');
