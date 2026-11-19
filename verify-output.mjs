import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const scratch = process.platform === 'win32' ? join(tmpdir(), 'opencode') : tmpdir();
const directory = mkdtempSync(join(process.env.MAKEFUN_OUTPUT_DIR ?? scratch, 'news18-verify-'));
const checksum = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const outputs = [];
try {
  for (let run = 1; run <= 2; run++) {
    const output = join(directory, `run-${run}`);
    const child = spawnSync(process.execPath, [join(root, 'main.ts')], {
      cwd: root,
      env: { ...process.env, MAKEFUN_OUTPUT_DIR: output },
      encoding: 'utf8', timeout: 10_000,
    });
    if (child.status !== 0) throw new Error(child.stderr || child.error?.message || 'Entrypoint failed.');
    const png = readFileSync(join(output, 'entry.png'));
    if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid PNG signature.');
    if (png.length >= 900_000 || png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) throw new Error('PNG must be exactly 1024×1024 and below 900,000 bytes.');
    let offset = 8, ended = false;
    const chunks = [];
    while (offset < png.length) {
      const length = png.readUInt32BE(offset), end = offset + 12 + length;
      if (end > png.length) throw new Error('Truncated PNG chunk.');
      const type = png.toString('ascii', offset + 4, offset + 8);
      if (checksum(png.subarray(offset + 4, end - 4)) !== png.readUInt32BE(end - 4)) throw new Error(`Invalid ${type} checksum.`);
      chunks.push(type);
      offset = end;
      if (type === 'IEND') { ended = true; break; }
    }
    if (!ended || offset !== png.length || chunks[0] !== 'IHDR' || !chunks.includes('IDAT')) throw new Error('Incomplete PNG.');
    outputs.push(png);
  }
  if (!outputs[0].equals(outputs[1]) || !outputs[0].equals(readFileSync(join(root, 'entry.png')))) throw new Error('Output is not deterministic.');
  console.log(JSON.stringify({ pass: true, runs: 2, node: process.version, platform: process.platform, width: 1024, height: 1024, bytes: outputs[0].length, sha256: createHash('sha256').update(outputs[0]).digest('hex'), pngChunkChecksums: 'valid', deterministic: true }));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
