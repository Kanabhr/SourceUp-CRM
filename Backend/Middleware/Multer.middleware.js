import multer from "multer";

// Only accept Excel (.xlsx) files
function fileFilter(_req, file, cb) {
  const allowed = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls fallback
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files (.xlsx) are allowed"));
  }
}

// memoryStorage — file lives in req.file.buffer, never touches disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB max
  fileFilter,
});

// Field name the frontend must use in FormData
export const uploadExcel = upload.single("leadsImport");
