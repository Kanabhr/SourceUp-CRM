import multer from "multer";
import fs from "fs";
import path from "path";
import { ApiError } from "../Utils/ApiError.js";

// ─── Shared config ──────────────────────────────────────────────────────────

const FIVE_MB = 5 * 1024 * 1024;

const IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const QUOTATION_MIME = [...IMAGE_MIME, "application/pdf"];

/**
 * Build a diskStorage engine whose destination ensures the target
 * directory exists before writing (created lazily on first upload).
 */
const makeDiskStorage = (subDir) => {
  const dest = path.join("public", "uploads", subDir);
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || `.${file.mimetype.split("/")[1]}`;
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${ext}`);
    },
  });
};

/**
 * File filter factory: rejects disallowed MIME types with a 400 ApiError
 * so it surfaces through the standard error envelope.
 */
const makeFileFilter = (allowed) => (_req, file, cb) => {
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError(400, `File type ${file.mimetype} is not allowed`));
};

// ─── Lead reference photos (images only, single field "photo") ──────────────

export const uploadLeadPhoto = multer({
  storage: makeDiskStorage("leads"),
  limits: { fileSize: FIVE_MB, files: 1 },
  fileFilter: makeFileFilter(IMAGE_MIME),
}).single("photo");

// ─── Quotation files (images + PDF, single field "file") ────────────────────

export const uploadQuotationFile = multer({
  storage: makeDiskStorage("quotations"),
  limits: { fileSize: FIVE_MB, files: 1 },
  fileFilter: makeFileFilter(QUOTATION_MIME),
}).single("file");
