#!/usr/bin/env node
/* Render icon.svg to the PNG sizes Chrome / Android launchers need. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(ROOT, 'icon.svg'));

function png(size, dest){
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: '#f4f6f9'
  });
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, r.render().asPng());
  console.log(path.relative(ROOT, dest), size + 'px');
}

png(192, path.join(ROOT, 'icon-192.png'));
png(512, path.join(ROOT, 'icon-512.png'));

const mip = (dpi, size) => path.join(ROOT, 'android/app/src/main/res', 'mipmap-' + dpi, 'ic_launcher.png');
png(48, mip('mdpi', 48));
png(72, mip('hdpi', 72));
png(96, mip('xhdpi', 96));
png(144, mip('xxhdpi', 144));
png(192, mip('xxxhdpi', 192));
