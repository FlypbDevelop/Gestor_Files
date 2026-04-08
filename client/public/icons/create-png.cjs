/**
 * Cria PNGs mínimos válidos para os ícones PWA.
 * Usa pure Node.js sem dependências externas.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint32BE(val) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(val, 0);
  return b;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = writeUint32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = writeUint32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function createPNG(size, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - raw pixel data
  const rowSize = size * 3;
  const rawData = Buffer.alloc((rowSize + 1) * size);
  for (let y = 0; y < size; y++) {
    rawData[y * (rowSize + 1)] = 0; // filter type none
    for (let x = 0; x < size; x++) {
      const offset = y * (rowSize + 1) + 1 + x * 3;
      rawData[offset] = r;
      rawData[offset + 1] = g;
      rawData[offset + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// Azul #3b82f6 = rgb(59, 130, 246)
const icon192 = createPNG(192, 59, 130, 246);
const icon512 = createPNG(512, 59, 130, 246);

fs.writeFileSync(path.join(__dirname, 'icon-192x192.png'), icon192);
fs.writeFileSync(path.join(__dirname, 'icon-512x512.png'), icon512);
console.log('PNGs criados: icon-192x192.png e icon-512x512.png');
