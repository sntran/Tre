// Byte tools for the export code: LZW compression, CRC-32 checksum,
// base64url text, and UTF-8. This module has no DOM code.

const MAX_CODES = 65536;

function bitLength(value) {
  return 32 - Math.clz32(value);
}

// The code width for code number i. The encoder and the decoder use the same rule.
function widthAt(i) {
  return Math.max(9, bitLength(Math.min(255 + i, MAX_CODES - 1)));
}

export function compress(bytes) {
  const out = [];
  let buffer = 0;
  let bits = 0;
  const write = (code, width) => {
    for (let b = 0; b < width; b++) {
      buffer |= ((code >>> b) & 1) << bits;
      bits++;
      if (bits === 8) {
        out.push(buffer);
        buffer = 0;
        bits = 0;
      }
    }
  };
  const n = bytes.length;
  // The first 4 bytes hold the length of the input.
  out.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
  if (n === 0) return Uint8Array.from(out);

  const dict = new Map();
  let next = 256;
  let w = bytes[0];
  let index = 0;
  for (let i = 1; i < n; i++) {
    const c = bytes[i];
    const key = w * 256 + c;
    const found = dict.get(key);
    if (found !== undefined) {
      w = found;
    } else {
      write(w, widthAt(index++));
      if (next < MAX_CODES) dict.set(key, next++);
      w = c;
    }
  }
  write(w, widthAt(index));
  if (bits > 0) out.push(buffer);
  return Uint8Array.from(out);
}

export function decompress(data) {
  if (data.length < 4) throw new Error('Data is too short');
  const n = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
  if (n < 0 || n > 50_000_000) throw new Error('Bad length');
  const out = new Uint8Array(n);
  if (n === 0) return out;

  let pos = 32; // bit position after the length
  const totalBits = data.length * 8;
  const read = (width) => {
    if (pos + width > totalBits) throw new Error('Data ends too soon');
    let code = 0;
    for (let b = 0; b < width; b++) {
      const byte = data[(pos + b) >>> 3];
      code |= ((byte >>> ((pos + b) & 7)) & 1) << b;
    }
    pos += width;
    return code;
  };

  const prefix = new Int32Array(MAX_CODES);
  const suffix = new Uint8Array(MAX_CODES);
  const first = new Uint8Array(MAX_CODES);
  for (let i = 0; i < 256; i++) {
    prefix[i] = -1;
    suffix[i] = i;
    first[i] = i;
  }
  let size = 256;
  let length = 0;
  const stack = new Uint8Array(MAX_CODES);

  const emit = (code) => {
    let top = 0;
    let c = code;
    while (c !== -1) {
      stack[top++] = suffix[c];
      c = prefix[c];
    }
    if (length + top > n) throw new Error('Data is too long');
    while (top > 0) out[length++] = stack[--top];
  };

  let index = 0;
  let w = read(widthAt(index++));
  if (w > 255) throw new Error('Bad first code');
  emit(w);
  while (length < n) {
    const code = read(widthAt(index++));
    let entryFirst;
    if (code < size) {
      entryFirst = first[code];
      emit(code);
    } else if (code === size && size < MAX_CODES) {
      entryFirst = first[w];
      // The special case: the code is the entry that we add now.
      prefix[size] = w;
      suffix[size] = entryFirst;
      first[size] = first[w];
      size++;
      emit(code);
      w = code;
      continue;
    } else {
      throw new Error('Bad code');
    }
    if (size < MAX_CODES) {
      prefix[size] = w;
      suffix[size] = entryFirst;
      first[size] = first[w];
      size++;
    }
    w = code;
  }
  return out;
}

let crcTable = null;

export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function toBase64Url(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    text += ALPHABET[(triple >>> 18) & 63] + ALPHABET[(triple >>> 12) & 63];
    if (i + 1 < bytes.length) text += ALPHABET[(triple >>> 6) & 63];
    if (i + 2 < bytes.length) text += ALPHABET[triple & 63];
  }
  return text;
}

export function fromBase64Url(text) {
  const clean = text.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_-]*$/.test(clean)) throw new Error('Bad characters');
  if (clean.length % 4 === 1) throw new Error('Bad length');
  const out = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4);
    let triple = 0;
    for (let k = 0; k < 4; k++) triple = (triple << 6) | (k < chunk.length ? ALPHABET.indexOf(chunk[k]) : 0);
    out.push((triple >>> 16) & 255);
    if (chunk.length > 2) out.push((triple >>> 8) & 255);
    if (chunk.length > 3) out.push(triple & 255);
  }
  return Uint8Array.from(out);
}

export function utf8Encode(text) {
  return new TextEncoder().encode(text);
}

export function utf8Decode(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
