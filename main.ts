import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const image = new URL('./entry.png', import.meta.url);
const bytes = readFileSync(image);
const info = statSync(image);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

if (!bytes.subarray(0, 8).equals(pngSignature)) {
  throw new Error('entry.png must be a PNG image.');
}
if (info.size > 1_048_576) {
  throw new Error('entry.png exceeds the one-megabyte limit.');
}
if (bytes.readUInt32BE(16) > 1024 || bytes.readUInt32BE(20) > 1024) {
  throw new Error('entry.png must be no larger than 1024 by 1024 pixels.');
}

mkdirSync(output, { recursive: true });
copyFileSync(image, join(output, 'entry.png'));
