import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const toolsIndex = process.argv.indexOf('--tools');
const tools = toolsIndex >= 0 ? process.argv[toolsIndex + 1] : process.env.NEWS_RENDER_TOOLS;
const { chromium } = tools
  ? createRequire(join(resolve(tools), 'package.json'))('playwright-core')
  : await import('playwright-core');
const browserPath = process.env.NEWS_BROWSER ?? [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find(existsSync);
if (!browserPath) throw new Error('Set NEWS_BROWSER to a Chromium executable.');

const scratch = process.platform === 'win32' ? join(tmpdir(), 'opencode') : tmpdir();
const output = process.argv.includes('--preview')
  ? join(mkdtempSync(join(scratch, 'news18-preview-')), 'entry.png')
  : join(root, 'entry.png');
const auditDirectory = mkdtempSync(join(scratch, 'news18-audit-'));
const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--disable-gpu', '--disable-lcd-text', '--font-render-hinting=none'],
});
const artifacts = [];
const reports = [];
try {
  for (let run = 1; run <= 2; run++) {
    const context = await browser.newContext({
      viewport: { width: 2048, height: 2048 },
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'en-GB',
      timezoneId: 'UTC',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => {
      errors.push(`Unexpected network request: ${route.request().url()}`);
      return route.abort();
    });
    await page.goto(pathToFileURL(join(root, 'render.html')).href);
    await page.evaluate(() => document.fonts.ready);
    const audit = await page.evaluate(() => {
      const problems = [];
      const rect = node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const contains = (a, b, tolerance = 1.5) => b.left >= a.left - tolerance
        && b.right <= a.right + tolerance && b.top >= a.top - tolerance
        && b.bottom <= a.bottom + tolerance;
      const label = element => `${element.tagName.toLowerCase()}.${element.classList.value}`;
      const expected = { '.lead': 3, '.small-card': 10, '.quick-item': 27 };
      for (const [selector, count] of Object.entries(expected)) {
        if (document.querySelectorAll(selector).length !== count) problems.push(`${selector}: expected ${count}`);
      }
      const storyIds = [...document.querySelectorAll('[data-story]')].map(e => Number(e.dataset.story));
      if (storyIds.length !== 40 || storyIds.some((id, i) => id !== i + 1)) problems.push('Story numbering must be 1–40 exactly once.');
      const leadRows = [...document.querySelectorAll('.lead')].map(e => Math.round(e.getBoundingClientRect().top));
      const smallRows = [...document.querySelectorAll('.small-card')].map(e => Math.round(e.getBoundingClientRect().top));
      if (new Set(leadRows).size !== 1 || new Set(smallRows).size !== 2
        || smallRows.filter(y => y === smallRows[0]).length !== 5) problems.push('Expected layout 3+5+5.');
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      if (new Set(ids).size !== ids.length) problems.push('Duplicate DOM/SVG IDs.');
      for (const text of document.querySelectorAll('svg text')) {
        const bounds = text.getBBox(), matrix = text.getScreenCTM();
        const corners = [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y + bounds.height]]
          .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
        const box = { left: corners[0].x, top: corners[0].y, right: corners[1].x, bottom: corners[1].y };
        if (!contains(rect(text.ownerSVGElement), box)) problems.push(`SVG text outside viewport: ${text.textContent}`);
      }
      const mapPins = document.querySelectorAll('#world-map [data-story-pin]');
      if (mapPins.length !== 40) problems.push(`Expected 40 map pins, got ${mapPins.length}.`);
      for (const element of document.querySelectorAll('.page > *, .lead, .small-card, .quick-item')) {
        if (!contains(rect(element.parentElement), rect(element))) problems.push(`Container outside parent: ${label(element)}`);
      }
      for (const element of document.querySelectorAll('h1,h2,h3,p,.lead-meta,.small-meta,.quick-copy,.legend-key,.numbers-list')) {
        if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
          problems.push(`Text overflow: ${label(element)} ${element.textContent.slice(0, 70)}`);
        }
      }
      const textBoxes = [];
      const walker = document.createTreeWalker(document.querySelector('.page'), NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const parent = node.parentElement;
        if (parent.closest('defs')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width < .1 || r.height < .1) continue;
          const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          textBoxes.push({ ...box, node, text: node.textContent.trim().slice(0, 60) });
          let ancestor = parent;
          while (ancestor && ancestor !== document.body) {
            const style = getComputedStyle(ancestor);
            const clips = /(hidden|clip|auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`);
            const ownsText = ancestor.matches('article,.masthead,aside,footer,.legend-key,.numbers,.region-row');
            if ((clips || ownsText || ancestor instanceof SVGSVGElement) && !contains(rect(ancestor), box)) {
              problems.push(`Text clipped by ${label(ancestor)}: ${node.textContent.trim().slice(0, 70)}`);
              break;
            }
            ancestor = ancestor.parentElement;
          }
        }
      }
      for (const element of document.querySelectorAll('h1,h2,h3,p,.quick-copy,.legend-key')) {
        const owner = element.closest('article,header,aside,footer') ?? element.parentElement;
        if (!contains(rect(owner), rect(element))) problems.push(`Text block outside ${label(owner)}: ${element.textContent.slice(0, 70)} ${JSON.stringify({ owner: rect(owner), block: rect(element) })}`);
      }
      let overlaps = 0;
      for (let a = 0; a < textBoxes.length; a++) {
        for (let b = a + 1; b < textBoxes.length; b++) {
          const x = textBoxes[a], y = textBoxes[b];
          if (x.node === y.node) continue;
          if (Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1.5
            && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1.5) {
            overlaps++;
            problems.push(`Text overlap: ${x.text} / ${y.text}`);
          }
        }
      }
      const rgb = text => text.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      const luminance = color => color.slice(0, 3).map(c => {
        const v = c / 255;
        return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
      }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      let minimumContrast = Infinity;
      let contrastChecked = 0;
      for (const element of document.querySelectorAll('.page *:not(svg):not(svg *)')) {
        if (![...element.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) continue;
        const style = getComputedStyle(element);
        let parent = element, background;
        while (parent) {
          const value = rgb(getComputedStyle(parent).backgroundColor);
          if (value.length < 4 || value[3] === 1) { background = value; break; }
          parent = parent.parentElement;
        }
        if (!background) continue;
        const a = luminance(rgb(style.color)), b = luminance(background);
        const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        minimumContrast = Math.min(minimumContrast, contrast);
        contrastChecked++;
        const finalSize = parseFloat(style.fontSize) / 2;
        const large = finalSize >= 24 || (finalSize >= 18.66 && Number(style.fontWeight) >= 700);
        if (contrast < (large ? 3 : 4.5)) problems.push(`Low contrast ${contrast.toFixed(2)}: ${element.textContent.slice(0, 65)}`);
      }
      return {
        problems: [...new Set(problems)], textFragments: textBoxes.length, overlaps,
        storyCount: storyIds.length, illustratedCards: 13, layout: [3, 5, 5],
        mapPins: mapPins.length, contrastChecked, minimumContrast: Number(minimumContrast.toFixed(2)),
        masthead: getComputedStyle(document.querySelector('.masthead')).backgroundColor,
      };
    });
    audit.problems.push(...errors);
    const source = await page.screenshot({ type: 'png', animations: 'disabled' });
    writeFileSync(join(auditDirectory, `render-${run}-2048.png`), source);
    const scaled = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, 1024, 1024);
      const pixels = context.getImageData(0, 0, 1024, 1024).data;
      let minimum = 255, maximum = 0, opaque = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const luma = .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
        minimum = Math.min(minimum, luma);
        maximum = Math.max(maximum, luma);
        if (pixels[i + 3] === 255) opaque++;
      }
      const index = (20 * 1024 + 25) * 4;
      return {
        png: canvas.toDataURL('image/png').split(',')[1],
        pixels: { minimumLuma: Number(minimum.toFixed(2)), maximumLuma: Number(maximum.toFixed(2)), opaquePixels: opaque, mastheadRGB: [...pixels.slice(index, index + 3)] },
      };
    }, source.toString('base64'));
    const png = Buffer.from(scaled.png, 'base64');
    const sha256 = createHash('sha256').update(png).digest('hex');
    if (png.length >= 900_000) audit.problems.push(`Image too large: ${png.length} bytes.`);
    if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) audit.problems.push('Expected 1024×1024 PNG.');
    if (scaled.pixels.opaquePixels !== 1024 * 1024) audit.problems.push('Unexpected transparent pixels.');
    if (scaled.pixels.maximumLuma - scaled.pixels.minimumLuma < 200) audit.problems.push('Insufficient pixel luminance range.');
    artifacts.push(png);
    reports.push({ run, sha256, bytes: png.length, width: 1024, height: 1024, ...audit, pixels: scaled.pixels });
    await context.close();
  }
} finally {
  await browser.close();
}
const deterministic = artifacts[0].equals(artifacts[1]);
const report = { pass: deterministic && reports.every(r => r.problems.length === 0), deterministic, reports, auditDirectory };
writeFileSync(join(auditDirectory, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`);
if (report.pass || process.argv.includes('--preview')) writeFileSync(output, artifacts[0]);
console.log(JSON.stringify({ ...report, output: report.pass || process.argv.includes('--preview') ? output : null }, null, 2));
if (!report.pass) process.exitCode = 1;
