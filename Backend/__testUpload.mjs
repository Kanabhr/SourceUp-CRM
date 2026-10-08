import "./loadEnv.js";
import express from "express";
import { uploadExcel } from "./Middleware/Multer.middleware.js";
import { importPreview } from "./Controllers/LeadImport.controller.js";
import cookieParser from "cookie-parser";

// Stub VerifyJWT — bypass auth so we can test the upload handler directly
const app = express();
app.use(cookieParser());

// Inject a fake user the way VerifyJWT would
app.use((req, _res, next) => {
  req.user = { _id: "000000000000000000000001", role: "superadmin" };
  next();
});

app.use((err, _req, res, _next) => {
  console.error("HANDLER ERROR:", err.message, err.stack);
  res.status(500).json({ error: err.message });
});

app.post("/test-upload", uploadExcel, importPreview);

app.use((err, _req, res, _next) => {
  console.error("GLOBAL ERROR:", err.message);
  res.status(500).json({ error: err.message });
});

app.listen(3099, () => console.log("Test server on 3099"));
