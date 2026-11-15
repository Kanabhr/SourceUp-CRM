import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./Routes/Auth.routes.js";
import userRouter from "./Routes/User.routes.js";
import dealRouter from "./Routes/Deal.routes.js";
import purchaseRouter from "./Routes/Purchase.routes.js";
import leadRouter from "./Routes/Lead.routes.js";
import leadImportRouter from "./Routes/LeadImport.routes.js";
import vendorRouter from "./Routes/Vendor.routes.js";
import quotationRouter from "./Routes/Quotation.routes.js";
import dashboardRouter from "./Routes/Dashboard.routes.js";
import reportsRouter from "./Routes/Reports.routes.js";
import exportRouter from "./Routes/Export.routes.js";
import servicePrefixRouter from "./Routes/ServicePrefix.routes.js";
import { VerifyJWT } from "./Middleware/Auth.middleware.js";

const app = express();

const isProd = process.env.NODE_ENV === "production";

// Render (and Vercel, when it proxies /api/v1 to Render) sit in front of this
// app. Without this, req.ip is the proxy's IP, so every user would share one
// login rate-limit bucket. TRUST_PROXY_HOPS = number of proxies in front:
//   1 = Render only (browser calls Render directly)
//   2 = Vercel rewrite -> Render (recommended setup, see Frontend/vercel.json)
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS) || 1);

const allowedOrigins = [
  // Always allow the configured frontend URL (Vercel deployment)
  process.env.FRONTEND_URL,
  // Allow localhost only in development
  ...(isProd ? [] : [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4173",
  ]),
]
  .filter(Boolean)
  // Browsers send Origin without a trailing slash; tolerate one in the env var
  .map((origin) => origin.replace(/\/+$/, ""));

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
// Uploaded photos / quotation files: login required (previously public),
// and nosniff so a mislabelled file can never be executed as HTML/JS.
app.use(
  "/uploads",
  VerifyJWT,
  express.static("public/uploads", {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  }),
);
app.get("/api/v1/health", (_req, res) => res.status(200).json({ status: "OK" }));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/deals", dealRouter);
app.use("/api/v1/purchase", purchaseRouter);
app.use("/api/v1/vendors", vendorRouter);
app.use("/api/v1/leads/import", leadImportRouter);
app.use("/api/v1/leads", leadRouter);
app.use("/api/v1/quotations", quotationRouter);
app.use("/api/v1/dashboard", dashboardRouter);
app.use("/api/v1/reports", reportsRouter);
app.use("/api/v1/export", exportRouter);
app.use("/api/v1/service-prefixes", servicePrefixRouter);
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || err.statuscode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});
export { app };
