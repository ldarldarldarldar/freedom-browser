// Freedom Browser - read-only LevelDB reader, used once to recover the old UI data from "Local Storage/leveldb".
// Pages on file:// can no longer touch localStorage, so the values from older versions are read from disk.
// Handles write-ahead logs (.log) and sorted tables (.ldb/.sst) with Snappy compression.
const fs = require('fs');
const path = require('path');

const TABLE_MAGIC = 0xdb4775248b80fb57n;

function readVarint(buf, start) {
  let value = 0;
  let factor = 1;
  let pos = start;
  for (;;) {
    if (pos >= buf.length || factor > 2 ** 49) throw new Error('Bad varint');
    const byte = buf[pos++];
    value += (byte & 0x7f) * factor;
    if (!(byte & 0x80)) return [value, pos];
    factor *= 128;
  }
}

function snappyDecompress(input) {
  const [length, start] = readVarint(input, 0);
  const output = Buffer.allocUnsafe(length);
  let pos = start;
  let out = 0;
  while (pos < input.length) {
    const tag = input[pos++];
    const kind = tag & 3;
    if (kind === 0) {
      let size = tag >> 2;
      if (size >= 60) {
        const bytes = size - 59;
        size = input.readUIntLE(pos, bytes);
        pos += bytes;
      }
      size += 1;
      input.copy(output, out, pos, pos + size);
      pos += size;
      out += size;
    } else {
      let size;
      let offset;
      if (kind === 1) {
        size = ((tag >> 2) & 7) + 4;
        offset = ((tag >> 5) << 8) | input[pos];
        pos += 1;
      } else if (kind === 2) {
        size = (tag >> 2) + 1;
        offset = input.readUInt16LE(pos);
        pos += 2;
      } else {
        size = (tag >> 2) + 1;
        offset = input.readUInt32LE(pos);
        pos += 4;
      }
      if (offset === 0 || offset > out) throw new Error('Bad Snappy data');
      for (let i = 0; i < size; i++, out++) output[out] = output[out - offset]; // copies may overlap
    }
  }
  if (out !== length) throw new Error('Bad Snappy length');
  return output;
}

function readLog(file, record) {
  const data = fs.readFileSync(file);
  const BLOCK = 32768;
  let pos = 0;
  let parts = [];
  while (pos + 7 <= data.length) {
    const leftInBlock = BLOCK - (pos % BLOCK);
    if (leftInBlock < 7) { pos += leftInBlock; continue; }
    const size = data.readUInt16LE(pos + 4);
    const type = data[pos + 6];
    if (type === 0 && size === 0) { pos += leftInBlock; continue; } // zero padding
    if (pos + 7 + size > data.length) break; // torn tail of a crash: nothing after it is valid
    parts.push(data.subarray(pos + 7, pos + 7 + size));
    pos += 7 + size;
    if (type === 1 || type === 4) {
      readBatch(Buffer.concat(parts), record);
      parts = [];
    } else if (type !== 2 && type !== 3) {
      parts = [];
    }
  }
}

function readBatch(batch, record) {
  if (batch.length < 12) return;
  let sequence = Number(batch.readBigUInt64LE(0));
  const count = batch.readUInt32LE(8);
  let pos = 12;
  for (let i = 0; i < count && pos < batch.length; i++, sequence++) {
    const kind = batch[pos++];
    const [keySize, keyStart] = readVarint(batch, pos);
    const key = batch.subarray(keyStart, keyStart + keySize);
    pos = keyStart + keySize;
    if (kind === 1) {
      const [valueSize, valueStart] = readVarint(batch, pos);
      record(key, sequence, batch.subarray(valueStart, valueStart + valueSize));
      pos = valueStart + valueSize;
    } else {
      record(key, sequence, null);
    }
  }
}

function readBlock(table, offset, size) {
  const raw = table.subarray(offset, offset + size);
  const compression = table[offset + size];
  if (compression === 0) return raw;
  if (compression === 1) return snappyDecompress(raw);
  throw new Error(`Unknown block compression ${compression}`);
}

function blockEntries(block, visit) {
  const restarts = block.readUInt32LE(block.length - 4);
  const end = block.length - 4 - restarts * 4;
  let pos = 0;
  let key = Buffer.alloc(0);
  while (pos < end) {
    let shared; let unshared; let valueSize;
    [shared, pos] = readVarint(block, pos);
    [unshared, pos] = readVarint(block, pos);
    [valueSize, pos] = readVarint(block, pos);
    key = Buffer.concat([key.subarray(0, shared), block.subarray(pos, pos + unshared)]);
    pos += unshared;
    visit(key, block.subarray(pos, pos + valueSize));
    pos += valueSize;
  }
}

function readTable(file, record) {
  const table = fs.readFileSync(file);
  // A table cut short by a crash has no footer. It was never committed, its data is still in the log.
  if (table.length < 48 || table.readBigUInt64LE(table.length - 8) !== TABLE_MAGIC) return;
  const footer = table.subarray(table.length - 48);
  let pos = readVarint(footer, 0)[1];
  pos = readVarint(footer, pos)[1]; // skip the metaindex handle
  const [indexOffset, next] = readVarint(footer, pos);
  const [indexSize] = readVarint(footer, next);
  blockEntries(readBlock(table, indexOffset, indexSize), (_, handle) => {
    const [offset, after] = readVarint(handle, 0);
    const [size] = readVarint(handle, after);
    blockEntries(readBlock(table, offset, size), (internalKey, value) => {
      const trailer = internalKey.subarray(internalKey.length - 8);
      const kind = trailer[0];
      const sequence = Number(trailer.readBigUInt64LE(0) >> 8n);
      record(internalKey.subarray(0, internalKey.length - 8), sequence, kind === 1 ? value : null);
    });
  });
}

/** Latest value of every live key: Map of latin1 key -> Buffer */
function readLevelDb(dir) {
  const latest = new Map();
  const record = (key, sequence, value) => {
    const id = key.toString('latin1');
    const known = latest.get(id);
    if (!known || sequence > known.sequence) latest.set(id, { sequence, value: value && Buffer.from(value) });
  };
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (name.endsWith('.log')) readLog(file, record);
    else if (name.endsWith('.ldb') || name.endsWith('.sst')) readTable(file, record);
  }
  const live = new Map();
  for (const [key, { value }] of latest) if (value) live.set(key, value);
  return live;
}

// Chromium's localStorage text: first byte 0 = UTF-16LE, 1 = Latin-1
function decodeStorageText(buf) {
  if (buf.length === 0) return '';
  return buf[0] === 0 ? buf.subarray(1).toString('utf16le') : buf.subarray(1).toString('latin1');
}

/** All localStorage items of one origin as [key, value] pairs */
function readLocalStorageOrigin(leveldbDir, origin) {
  if (!fs.existsSync(leveldbDir)) return [];
  const prefix = `_${origin}\0`;
  const items = [];
  for (const [key, value] of readLevelDb(leveldbDir)) {
    if (key.startsWith(prefix)) items.push([decodeStorageText(Buffer.from(key.slice(prefix.length), 'latin1')), decodeStorageText(value)]);
  }
  return items;
}

module.exports = { readLocalStorageOrigin };
