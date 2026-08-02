import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { logger } from "../config/logger.js";

/* ------------------------------------------------------------------ */
/*  Storage configuration                                              */
/* ------------------------------------------------------------------ */
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, path.resolve("uploads"));
  },
  filename: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

/* ------------------------------------------------------------------ */
/*  MIME type + extension allowlists                                   */
/* ------------------------------------------------------------------ */
const RESUME_ALLOWED = new Map([
  ["application/pdf", [".pdf"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [".docx"]],
]);

const AUDIO_ALLOWED = new Map([
  ["audio/webm", [".webm"]],
  ["audio/wav", [".wav"]],
  ["audio/mpeg", [".mp3", ".mpeg"]],
  ["audio/mp4", [".mp4", ".m4a"]],
  ["audio/ogg", [".ogg", ".oga"]],
  ["audio/x-wav", [".wav"]],
]);

/* ------------------------------------------------------------------ */
/*  Magic byte signatures for validation                               */
/* ------------------------------------------------------------------ */
const MAGIC_BYTES = {
  pdf: { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  docx: { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK zip header
  wav: { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
  mp3_id3: { offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
  mp3_sync: { offset: 0, bytes: [0xff, 0xfb] }, // MP3 sync
  ogg: { offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] }, // OggS
  webm: { offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }, // EBML (WebM/MKV)
  mp4: { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp
};

function matchesMagicBytes(buffer, signature) {
  const { offset, bytes } = signature;
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Validates file magic bytes after upload to prevent MIME spoofing.
 */
export async function validateMagicBytes(filePath, expectedType) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    if (expectedType === "resume") {
      return (
        matchesMagicBytes(buffer, MAGIC_BYTES.pdf) ||
        matchesMagicBytes(buffer, MAGIC_BYTES.docx)
      );
    }

    if (expectedType === "audio") {
      return (
        matchesMagicBytes(buffer, MAGIC_BYTES.wav) ||
        matchesMagicBytes(buffer, MAGIC_BYTES.mp3_id3) ||
        matchesMagicBytes(buffer, MAGIC_BYTES.mp3_sync) ||
        matchesMagicBytes(buffer, MAGIC_BYTES.ogg) ||
        matchesMagicBytes(buffer, MAGIC_BYTES.webm) ||
        matchesMagicBytes(buffer, MAGIC_BYTES.mp4)
      );
    }

    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  File filter with extension + MIME validation                       */
/* ------------------------------------------------------------------ */
function createFileFilter(allowedMap, fileType) {
  return (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeAllowedExtensions = allowedMap.get(file.mimetype);

    if (!mimeAllowedExtensions) {
      callback(new Error(`File type ${file.mimetype} is not allowed for ${fileType}`));
      return;
    }

    if (!mimeAllowedExtensions.includes(ext) && ext !== "") {
      callback(new Error(`File extension ${ext} does not match MIME type ${file.mimetype}`));
      return;
    }

    callback(null, true);
  };
}

/* ------------------------------------------------------------------ */
/*  Multer instances                                                   */
/* ------------------------------------------------------------------ */
export const resumeUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: createFileFilter(RESUME_ALLOWED, "resume"),
}).single("resume");

export const audioUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: createFileFilter(AUDIO_ALLOWED, "audio"),
}).single("audio");

/* ------------------------------------------------------------------ */
/*  Temp file cleanup scheduler                                        */
/* ------------------------------------------------------------------ */
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TEMP_AGE_MS = 60 * 60 * 1000; // 1 hour

export function startTempCleanup() {
  setInterval(async () => {
    const uploadsDir = path.resolve("uploads");
    try {
      const files = fs.readdirSync(uploadsDir);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        try {
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > MAX_TEMP_AGE_MS) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch {
          // File may have been removed already
        }
      }

      if (cleaned > 0) {
        logger.info({ msg: "Temp file cleanup", cleaned, total: files.length });
      }
    } catch (error) {
      logger.warn({ msg: "Temp cleanup error", error: error.message });
    }
  }, CLEANUP_INTERVAL_MS);
}
