import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  table[i] = c;
}

function createPng(width, height, pixelFn) {
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const checksum = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(checksum, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw Freedom Shield & "F"
function freedomPixel(x, y, w, h) {
  const nx = (x / w) * 512;
  const ny = (y / h) * 512;

  // Center coordinate
  const cx = 256;
  const dx = Math.abs(nx - cx);

  // Shield boundary calculation
  let inShield = false;
  let isBorder = false;

  if (ny >= 36 && ny <= 480) {
    let maxDx = 0;
    if (ny < 120) {
      maxDx = 180 + (ny - 36) * 0.25;
    } else if (ny < 300) {
      maxDx = 200 - (ny - 120) * 0.15;
    } else {
      maxDx = 173 * (1 - Math.pow((ny - 300) / 180, 1.6));
    }

    if (dx <= maxDx) {
      inShield = true;
      if (dx >= maxDx - 14 || ny <= 48 || (ny >= 468 && dx <= 20)) {
        isBorder = true;
      }
    }
  }

  if (!inShield) {
    return [0, 0, 0, 0]; // Transparent
  }

  // Geometric Mint Green "F" inside shield
  // Top bar: [184..336, 140..196]
  // Stem: [184..244, 140..372]
  // Mid bar: [184..300, 240..296]
  const inStem = nx >= 184 && nx <= 244 && ny >= 140 && ny <= 372;
  const inTopBar = nx >= 184 && nx <= 336 && ny >= 140 && ny <= 196;
  const inMidBar = nx >= 184 && nx <= 300 && ny >= 240 && ny <= 296;

  if (inStem || inTopBar || inMidBar) {
    return [52, 211, 153, 255]; // Mint Green (#34d399)
  }

  if (isBorder) {
    return [16, 185, 129, 255]; // Emerald Border (#10b981)
  }

  return [5, 46, 22, 255]; // Very Dark Green Shield Background (#052e16)
}

// Generate icons
const iconsDir = path.resolve('src-tauri/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const sizes = [
  { file: '32x32.png', size: 32 },
  { file: '128x128.png', size: 128 },
  { file: '128x128@2x.png', size: 256 },
  { file: 'icon.png', size: 512 },
];

for (const { file, size } of sizes) {
  const pngBuf = createPng(size, size, freedomPixel);
  fs.writeFileSync(path.join(iconsDir, file), pngBuf);
  console.log(`Created ${file} (${size}x${size})`);
}

// Also write public/icon.png and ICO placeholder
const png32 = fs.readFileSync(path.join(iconsDir, '32x32.png'));
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), png32);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), png32);
fs.writeFileSync(path.resolve('public/icon.png'), fs.readFileSync(path.join(iconsDir, 'icon.png')));
console.log('All Freedom icon assets generated successfully.');
