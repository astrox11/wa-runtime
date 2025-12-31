import fs from "fs";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { spawn } from "child_process";
import path from "path";

/**
 * WebP Mux - TypeScript implementation for WebP EXIF handling
 * Using native FFmpeg CLI via child_process.spawn
 */

// Type Definitions
interface StickerMetadata {
  packname?: string;
  author?: string;
  categories?: string[];
  packId?: string;
}

interface FFmpegOptions {
  scale?: number;
  fps?: number;
  duration?: number;
  quality?: number;
}

interface ChunkData {
  fourCC: string;
  size: number;
  offset: number;
  data: Buffer;
  padding: number;
}

// Constants
const CHUNK_HEADER_SIZE = 8;
const RIFF_HEADER_SIZE = 12;

export const ChunkType = {
  RIFF: "RIFF",
  WEBP: "WEBP",
  VP8X: "VP8X",
  VP8: "VP8 ",
  VP8L: "VP8L",
  ALPH: "ALPH",
  ANIM: "ANIM",
  ANMF: "ANMF",
  ICCP: "ICCP",
  EXIF: "EXIF",
  XMP: "XMP ",
} as const;

class WebPChunk {
  fourCC: string;
  data: Buffer;

  constructor(fourCC: string, data: Buffer) {
    this.fourCC = fourCC;
    this.data = Buffer.isBuffer(data) ? data : Buffer.from(data);
  }

  get size(): number {
    return this.data.length;
  }

  get padding(): number {
    return this.size % 2 ? 1 : 0;
  }

  toBuffer(): Buffer {
    const buffer = Buffer.alloc(CHUNK_HEADER_SIZE + this.size + this.padding);
    buffer.write(this.fourCC, 0, 4, "ascii");
    buffer.writeUInt32LE(this.size, 4);
    this.data.copy(buffer, 8);
    if (this.padding) buffer[8 + this.size] = 0;
    return buffer;
  }

  static fromBuffer(buffer: Buffer, offset: number = 0): WebPChunk {
    const fourCC = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = buffer.slice(offset + 8, offset + 8 + size);
    return new WebPChunk(fourCC, data);
  }
}

// WebP Mux Class
class WebPMux {
  chunks: WebPChunk[];

  constructor(buffer?: Buffer) {
    this.chunks = [];
    if (buffer) {
      this.parse(buffer);
    }
  }

  parse(buffer: Buffer): void {
    if (buffer.toString("ascii", 0, 4) !== "RIFF") {
      throw new Error("Invalid WebP file: missing RIFF header");
    }

    if (buffer.toString("ascii", 8, 12) !== "WEBP") {
      throw new Error("Invalid WebP file: missing WEBP signature");
    }

    let offset = RIFF_HEADER_SIZE;
    while (offset < buffer.length) {
      if (offset + CHUNK_HEADER_SIZE > buffer.length) break;

      const chunk = WebPChunk.fromBuffer(buffer, offset);
      this.chunks.push(chunk);

      offset += CHUNK_HEADER_SIZE + chunk.size + chunk.padding;
    }
  }

  getChunk(fourCC: string): WebPChunk | undefined {
    return this.chunks.find((c) => c.fourCC === fourCC);
  }

  setChunk(fourCC: string, data: Buffer): void {
    const newChunk = new WebPChunk(fourCC, data);
    const index = this.chunks.findIndex((c) => c.fourCC === fourCC);

    if (index !== -1) {
      this.chunks[index] = newChunk;
    } else {
      this.chunks.push(newChunk);
    }

    // Update VP8X flags if setting EXIF
    if (fourCC === "EXIF") {
      this.updateVP8XFlags(0x08); // EXIF flag
    }
  }

  deleteChunk(fourCC: string): void {
    this.chunks = this.chunks.filter((c) => c.fourCC !== fourCC);
  }

  updateVP8XFlags(flag: number): void {
    const vp8x = this.getChunk("VP8X");
    if (vp8x) {
      vp8x.data[0] = vp8x.data[0] | flag;
    }
  }

  assemble(): Buffer {
    let totalSize = 4; // "WEBP"
    for (const chunk of this.chunks) {
      totalSize += CHUNK_HEADER_SIZE + chunk.size + chunk.padding;
    }

    const header = Buffer.alloc(RIFF_HEADER_SIZE);
    header.write("RIFF", 0, 4, "ascii");
    header.writeUInt32LE(totalSize, 4);
    header.write("WEBP", 8, 4, "ascii");

    const chunkBuffers = this.chunks.map((c) => c.toBuffer());
    return Buffer.concat([header, ...chunkBuffers]);
  }
}

// EXIF Builder Class
class ExifBuilder {
  static create(metadata: StickerMetadata): Buffer {
    const json = {
      "sticker-pack-id":
        metadata.packId || "https://github.com/AstroX11/wa-bridge",
      "sticker-pack-name": metadata.packname || "αѕтяσχ 2026",
      "sticker-pack-publisher": metadata.author || "αѕтяσχ11",
      emojis: Array.isArray(metadata.categories) ? metadata.categories : ["😀"],
    };

    // TIFF header (little-endian) + IFD entry for UserComment
    const exifHeader = Buffer.from([
      0x49,
      0x49, // Little-endian byte order marker
      0x2a,
      0x00, // TIFF magic number
      0x08,
      0x00,
      0x00,
      0x00, // Offset to first IFD
      0x01,
      0x00, // Number of IFD entries
      0x41,
      0x57, // Tag: Custom field for sticker data
      0x07,
      0x00, // Type: UNDEFINED
      0x00,
      0x00,
      0x00,
      0x00, // Count (placeholder, will be updated)
      0x16,
      0x00,
      0x00,
      0x00, // Offset to data
    ]);

    const jsonBuff = Buffer.from(JSON.stringify(json), "utf8");
    const exif = Buffer.concat([exifHeader, jsonBuff]);

    // Update count field with JSON data length
    exif.writeUInt32LE(jsonBuff.length, 14);

    return exif;
  }
}

// FFmpeg CLI Converter Class
class WebPConverter {
  /**
   * Execute FFmpeg command using spawn
   */
  private static async executeFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn("ffmpeg", args);

      let stderr = "";

      ffmpegProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpegProcess.on("error", (error: Error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });

      ffmpegProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}\n${stderr}`));
        }
      });
    });
  }

  /**
   * Convert image to WebP using FFmpeg CLI
   */
  static async imageToWebp(
    inputPath: string,
    outputPath: string,
    options: FFmpegOptions = {},
  ): Promise<void> {
    const { scale = 320, fps = 15 } = options;

    const args = [
      "-i",
      inputPath,
      "-vcodec",
      "libwebp",
      "-vf",
      `scale='min(${scale},iw)':min'(${scale},ih)':force_original_aspect_ratio=decrease,fps=${fps},pad=${scale}:${scale}:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse`,
      "-y",
      outputPath,
    ];

    await this.executeFFmpeg(args);
  }

  /**
   * Convert video to animated WebP using FFmpeg CLI
   */
  static async videoToWebp(
    inputPath: string,
    outputPath: string,
    options: FFmpegOptions = {},
  ): Promise<void> {
    const { scale = 320, fps = 15, duration = 5 } = options;

    const args = [
      "-i",
      inputPath,
      "-vcodec",
      "libwebp",
      "-vf",
      `scale='min(${scale},iw)':min'(${scale},ih)':force_original_aspect_ratio=decrease,fps=${fps},pad=${scale}:${scale}:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse`,
      "-loop",
      "0",
      "-ss",
      "00:00:00",
      "-t",
      `00:00:${duration.toString().padStart(2, "0")}`,
      "-preset",
      "default",
      "-an",
      "-vsync",
      "0",
      "-y",
      outputPath,
    ];

    await this.executeFFmpeg(args);
  }
}

// Utility Functions
function generateTempPath(ext: string = "webp"): string {
  return path.join(
    tmpdir(),
    `${randomBytes(6).readUIntLE(0, 6).toString(36)}.${ext}`,
  );
}

function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`Failed to cleanup file ${filePath}:`, error);
  }
}

// Main API Functions

/**
 * Convert image buffer to WebP buffer
 */
export async function imageToWebp(
  media: Buffer,
  options?: FFmpegOptions,
): Promise<Buffer> {
  const tmpIn = generateTempPath("jpg");
  const tmpOut = generateTempPath("webp");

  try {
    fs.writeFileSync(tmpIn, media);
    await WebPConverter.imageToWebp(tmpIn, tmpOut, options);
    return fs.readFileSync(tmpOut);
  } finally {
    cleanupFile(tmpIn);
    cleanupFile(tmpOut);
  }
}

/**
 * Convert video buffer to animated WebP buffer
 */
export async function videoToWebp(
  media: Buffer,
  options?: FFmpegOptions,
): Promise<Buffer> {
  const tmpIn = generateTempPath("mp4");
  const tmpOut = generateTempPath("webp");

  try {
    fs.writeFileSync(tmpIn, media);
    await WebPConverter.videoToWebp(tmpIn, tmpOut, options);
    return fs.readFileSync(tmpOut);
  } finally {
    cleanupFile(tmpIn);
    cleanupFile(tmpOut);
  }
}

/**
 * Write EXIF metadata to image and convert to WebP sticker
 */
export async function writeExifImg(
  media: Buffer,
  metadata: StickerMetadata,
  options?: FFmpegOptions,
): Promise<string> {
  const webpBuffer = await imageToWebp(media, options);

  if (!metadata?.packname && !metadata?.author) {
    const tmpOut = generateTempPath("webp");
    fs.writeFileSync(tmpOut, webpBuffer);
    return tmpOut;
  }

  const mux = new WebPMux(webpBuffer);
  const exifData = ExifBuilder.create(metadata);
  mux.setChunk("EXIF", exifData);

  const result = mux.assemble();
  const tmpOut = generateTempPath("webp");
  fs.writeFileSync(tmpOut, result);

  return tmpOut;
}

/**
 * Write EXIF metadata to video and convert to animated WebP sticker
 */
export async function writeExifVid(
  media: Buffer,
  metadata: StickerMetadata,
  options?: FFmpegOptions,
): Promise<string> {
  const webpBuffer = await videoToWebp(media, options);

  if (!metadata?.packname && !metadata?.author) {
    const tmpOut = generateTempPath("webp");
    fs.writeFileSync(tmpOut, webpBuffer);
    return tmpOut;
  }

  const mux = new WebPMux(webpBuffer);
  const exifData = ExifBuilder.create(metadata);
  mux.setChunk("EXIF", exifData);

  const result = mux.assemble();
  const tmpOut = generateTempPath("webp");
  fs.writeFileSync(tmpOut, result);

  return tmpOut;
}

/**
 * Write EXIF metadata to existing WebP buffer
 */
export async function writeExifWebp(
  media: Buffer,
  metadata: StickerMetadata,
): Promise<string> {
  if (!metadata?.packname && !metadata?.author) {
    const tmpOut = generateTempPath("webp");
    fs.writeFileSync(tmpOut, media);
    return tmpOut;
  }

  const mux = new WebPMux(media);
  const exifData = ExifBuilder.create(metadata);
  mux.setChunk("EXIF", exifData);

  const result = mux.assemble();
  const tmpOut = generateTempPath("webp");
  fs.writeFileSync(tmpOut, result);

  return tmpOut;
}

// Export classes for advanced usage
export {
  WebPMux,
  WebPChunk,
  ExifBuilder,
  WebPConverter,
  type StickerMetadata,
  type FFmpegOptions,
  type ChunkData,
};
