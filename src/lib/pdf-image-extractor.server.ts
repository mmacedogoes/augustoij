import { deflateSync } from "node:zlib";

// CRC32 table for standard PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Uint8Array, offset = 0, length = buf.length): number {
  let c = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeUint32BE(buf: Uint8Array, offset: number, val: number) {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

/**
 * Encodes a raw grayscale (colorType=0) or RGB (colorType=2) buffer to a standard PNG.
 */
export function encodePng(
  width: number,
  height: number,
  data: Uint8Array,
  colorType: 0 | 2 = 0,
): Uint8Array {
  const bytesPerPixel = colorType === 0 ? 1 : 3;
  const rawRowLen = 1 + width * bytesPerPixel;
  const rawData = new Uint8Array(height * rawRowLen);

  for (let y = 0; y < height; y++) {
    const rawOffset = y * rawRowLen;
    rawData[rawOffset] = 0; // Filter: None
    const srcOffset = y * width * bytesPerPixel;
    rawData.set(data.subarray(srcOffset, srcOffset + width * bytesPerPixel), rawOffset + 1);
  }

  const compressed = deflateSync(rawData, { level: 6 });

  // PNG Header (8) + IHDR (25) + IDAT (12 + compressed.length) + IEND (12)
  const totalLen = 8 + 25 + 12 + compressed.length + 12;
  const png = new Uint8Array(totalLen);

  // 1. Signature
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);

  // 2. IHDR Chunk (13 bytes payload)
  let p = 8;
  writeUint32BE(png, p, 13);
  p += 4;
  const ihdrTypeStart = p;
  png.set([0x49, 0x48, 0x44, 0x52], p); // "IHDR"
  p += 4;
  writeUint32BE(png, p, width);
  p += 4;
  writeUint32BE(png, p, height);
  p += 4;
  png[p++] = 8; // bit depth: 8
  png[p++] = colorType; // 0 = grayscale, 2 = RGB
  png[p++] = 0; // compression: deflate
  png[p++] = 0; // filter: none
  png[p++] = 0; // interlace: none
  const ihdrCrc = crc32(png, ihdrTypeStart, 4 + 13);
  writeUint32BE(png, p, ihdrCrc);
  p += 4;

  // 3. IDAT Chunk
  writeUint32BE(png, p, compressed.length);
  p += 4;
  const idatTypeStart = p;
  png.set([0x49, 0x44, 0x41, 0x54], p); // "IDAT"
  p += 4;
  png.set(compressed, p);
  p += compressed.length;
  const idatCrc = crc32(png, idatTypeStart, 4 + compressed.length);
  writeUint32BE(png, p, idatCrc);
  p += 4;

  // 4. IEND Chunk
  writeUint32BE(png, p, 0);
  p += 4;
  png.set([0x49, 0x45, 0x4e, 0x44], p); // "IEND"
  p += 4;
  writeUint32BE(png, p, 0xae426082);

  return png;
}

/**
 * Downsamples and converts a 1-bit monochrome bitmap (PDF.js kind: 1 / GRAYSCALE_1BPP)
 * into a crisp, antialiased 8-bit grayscale PNG.
 */
export function convertMonochromeBitmapToPng(
  rawBits: Uint8Array,
  width: number,
  height: number,
  maxDimension = 2400,
): Uint8Array {
  const bytesPerRow = Math.ceil(width / 8);

  // 1. Detect background vs ink color
  // In black-on-white documents, background is >85% of all pixels.
  let sampleCount = 0;
  let onesCount = 0;
  const step = Math.max(1, Math.floor(rawBits.length / 5000));
  for (let i = 0; i < rawBits.length; i += step) {
    let b = rawBits[i];
    for (let bit = 0; bit < 8; bit++) {
      if ((b & (1 << bit)) !== 0) onesCount++;
      sampleCount++;
    }
  }
  const inkBit = onesCount > sampleCount / 2 ? 0 : 1;

  // 2. Determine downsampling scale
  const maxDim = Math.max(width, height);
  const scale = maxDim > maxDimension ? Math.ceil(maxDim / maxDimension) : 1;

  const outW = Math.max(1, Math.floor(width / scale));
  const outH = Math.max(1, Math.floor(height / scale));
  const outPixels = new Uint8Array(outW * outH);

  const blockSize = scale * scale;

  for (let oy = 0; oy < outH; oy++) {
    const sy0 = oy * scale;
    const sy1 = Math.min(sy0 + scale, height);
    const dy = sy1 - sy0;
    const rowOffsetOut = oy * outW;

    for (let ox = 0; ox < outW; ox++) {
      const sx0 = ox * scale;
      const sx1 = Math.min(sx0 + scale, width);
      const dx = sx1 - sx0;
      const totalBitsInBlock = dy * dx || blockSize;

      let inkCount = 0;
      for (let y = sy0; y < sy1; y++) {
        const rowStart = y * bytesPerRow;
        for (let x = sx0; x < sx1; x++) {
          const byteVal = rawBits[rowStart + (x >> 3)];
          const bit = (byteVal >> (7 - (x & 7))) & 1;
          if (bit === inkBit) {
            inkCount++;
          }
        }
      }

      const inkFraction = inkCount / totalBitsInBlock;
      // 255 is pure white, 0 is pure black
      outPixels[rowOffsetOut + ox] = Math.round(255 * (1 - inkFraction));
    }
  }

  return encodePng(outW, outH, outPixels, 0);
}

/**
 * Extracts a page's scanned image using PDF.js / unpdf.
 * Handles CCITTFaxDecode (kind 1), RGB (kind 2), RGBA (kind 3), or embedded JPEG.
 */
export async function extrairImagemPaginaPdf(
  buffer: Uint8Array,
  pageIndex: number, // 0-based
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const { getDocumentProxy, getResolvedPDFJS } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer.slice());

  if (pageIndex < 0 || pageIndex >= pdf.numPages) {
    return null;
  }

  const page = await pdf.getPage(pageIndex + 1);
  const ops = await page.getOperatorList();
  const pdfjs = await getResolvedPDFJS();
  const OPS = pdfjs.OPS;

  // Search for the primary image operator in the page
  let targetImgId: string | null = null;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (
      fn === OPS.paintImageXObject ||
      fn === (OPS as Record<string, number>)["paintJpegXObject"] ||
      fn === OPS.paintImageMaskXObject ||
      fn === OPS.paintInlineImageXObject
    ) {
      if (args && args[0] && typeof args[0] === "string") {
        targetImgId = args[0];
        break;
      }
    }
  }

  if (!targetImgId) {
    return null;
  }

  const rawObj: any = await new Promise((resolve) => {
    if (typeof (page as any).objs?.get === "function") {
      try {
        (page as any).objs.get(targetImgId, (data: any) => resolve(data));
      } catch {
        resolve(null);
      }
    } else {
      resolve(null);
    }
  });

  if (!rawObj || !rawObj.data) {
    return null;
  }

  const width = rawObj.width;
  const height = rawObj.height;
  const data = rawObj.data as Uint8Array;

  // Kind 1: GRAYSCALE_1BPP (CCITTFaxDecode / 1-bit scan)
  if (rawObj.kind === 1 || (data.length === Math.ceil(width / 8) * height && rawObj.kind !== 2)) {
    const pngBytes = convertMonochromeBitmapToPng(data, width, height, 2400);
    return { mime: "image/png", bytes: pngBytes };
  }

  // Kind 2: RGB_24BPP
  if (rawObj.kind === 2 || data.length === width * height * 3) {
    const maxDim = Math.max(width, height);
    if (maxDim > 2400) {
      const scale = Math.ceil(maxDim / 2400);
      const outW = Math.floor(width / scale);
      const outH = Math.floor(height / scale);
      const outPixels = new Uint8Array(outW * outH * 3);
      const blockSize = scale * scale;

      for (let oy = 0; oy < outH; oy++) {
        const sy0 = oy * scale;
        const sy1 = Math.min(sy0 + scale, height);
        const dy = sy1 - sy0;
        for (let ox = 0; ox < outW; ox++) {
          const sx0 = ox * scale;
          const sx1 = Math.min(sx0 + scale, width);
          const dx = sx1 - sx0;
          const count = dy * dx || blockSize;

          let rSum = 0, gSum = 0, bSum = 0;
          for (let y = sy0; y < sy1; y++) {
            const rowOffset = y * width * 3;
            for (let x = sx0; x < sx1; x++) {
              const p = rowOffset + x * 3;
              rSum += data[p];
              gSum += data[p + 1];
              bSum += data[p + 2];
            }
          }
          const outOffset = (oy * outW + ox) * 3;
          outPixels[outOffset] = Math.round(rSum / count);
          outPixels[outOffset + 1] = Math.round(gSum / count);
          outPixels[outOffset + 2] = Math.round(bSum / count);
        }
      }
      return { mime: "image/png", bytes: encodePng(outW, outH, outPixels, 2) };
    }
    return { mime: "image/png", bytes: encodePng(width, height, data, 2) };
  }

  // Check if raw data is already JPEG SOI
  if (data.length > 2 && data[0] === 0xff && data[1] === 0xd8) {
    return { mime: "image/jpeg", bytes: data };
  }

  // Fallback: If 8-bit grayscale (data.length === width * height)
  if (data.length === width * height) {
    const maxDim = Math.max(width, height);
    if (maxDim > 2400) {
      const scale = Math.ceil(maxDim / 2400);
      const outW = Math.floor(width / scale);
      const outH = Math.floor(height / scale);
      const outPixels = new Uint8Array(outW * outH);
      const blockSize = scale * scale;
      for (let oy = 0; oy < outH; oy++) {
        const sy0 = oy * scale;
        const sy1 = Math.min(sy0 + scale, height);
        const dy = sy1 - sy0;
        for (let ox = 0; ox < outW; ox++) {
          const sx0 = ox * scale;
          const sx1 = Math.min(sx0 + scale, width);
          const dx = sx1 - sx0;
          let sum = 0;
          for (let y = sy0; y < sy1; y++) {
            const rowOffset = y * width;
            for (let x = sx0; x < sx1; x++) {
              sum += data[rowOffset + x];
            }
          }
          outPixels[oy * outW + ox] = Math.round(sum / (dy * dx || blockSize));
        }
      }
      return { mime: "image/png", bytes: encodePng(outW, outH, outPixels, 0) };
    }
    return { mime: "image/png", bytes: encodePng(width, height, data, 0) };
  }

  return null;
}
