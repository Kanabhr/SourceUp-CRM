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

const app = express();

const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = [
  // Always allow the configured frontend URL (Vercel deployment)
  process.env.FRONTEND_URL,
  // Allow localhost only in development
  ...(isProd ? [] : [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4173",
  ]),
].filter(Boolean);

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
app.use(express.static("public"));
app.use(cookieParser());
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
