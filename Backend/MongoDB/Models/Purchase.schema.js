import mongoose from "mongoose";

// ─── Enums ──────────────────────────────────────────────────────────────────

const VENDOR_COUNTRIES = ["India", "China", "Other"];
const PO_CURRENCIES = ["INR", "CNY", "USD"];
const QC_STATUSES = ["Pending", "Passed", "Failed"];
const PO_STATUSES = [
  "PO Raised", "In Production", "QC",
  "Dispatched", "Received", "Closed",
];

// Valid forward transitions
const PO_STATUS_TRANSITIONS = {
  "PO Raised":      ["In Production"],
  "In Production":  ["QC"],
  "QC":             ["Dispatched"],
  "Dispatched":     ["Received"],
  "Received":       ["Closed"],
  "Closed":         [],
};

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
    remark: { type: String, default: "" },
  },
  { _id: true },
);

// ─── Main schema ────────────────────────────────────────────────────────────

const purchaseSchema = new mongoose.Schema(
  {
    poId: {
      type: String,
      unique: true,
      sparse: true,
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: [true, "Deal reference is required"],
    },
    vendorRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    vendorName: { type: String, trim: true, default: "" },
    vendorCountry: {
      type: String,
      enum: VENDOR_COUNTRIES,
      default: "India",
    },
    vendorContact: { type: String, trim: true, default: "" },
    product: { type: String, trim: true, default: "" },
    specs: { type: String, trim: true, default: "" },

    // Pricing
    qty: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
    currency: {
      type: String,
      enum: PO_CURRENCIES,
      default: "INR",
    },
    exchangeRate: { type: Number, default: 1 },
    packagingCost: { type: Number, default: 0 },

    // China-specific costs
    freight: { type: Number, default: 0 },
    customsDuty: { type: Number, default: 0 },
    clearingCharges: { type: Number, default: 0 },
    insurance: { type: Number, default: 0 },

    // Auto-calculated
    landedCostPerUnit: { type: Number, default: 0 },
    totalLandedCost: { type: Number, default: 0 },

    // Payment
    vendorPaymentTerms: { type: String, trim: true, default: "" },
    advancePaid: {
      amount: { type: Number, default: 0 },
      date: { type: Date, default: null },
    },
    balancePaid: {
      amount: { type: Number, default: 0 },
      date: { type: Date, default: null },
    },

    // Dates
    productionStart: { type: Date, default: null },
    readyDate: { type: Date, default: null },
    dispatchDate: { type: Date, default: null },
    etaIndia: { type: Date, default: null },
    receivedDate: { type: Date, default: null },

    // Tracking
    blNo: { type: String, trim: true, default: "" },
    trackingNo: { type: String, trim: true, default: "" },

    // QC
    qcStatus: {
      type: String,
      enum: QC_STATUSES,
      default: "Pending",
    },
    qcRemarks: { type: String, trim: true, default: "" },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Status pipeline
    status: {
      type: String,
      enum: PO_STATUSES,
      default: "PO Raised",
    },
    statusHistory: [statusHistorySchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ dealId: 1 });
purchaseSchema.index({ vendorCountry: 1 });
purchaseSchema.index({ createdBy: 1 });

export {
  VENDOR_COUNTRIES, PO_CURRENCIES, QC_STATUSES,
  PO_STATUSES, PO_STATUS_TRANSITIONS,
};
export const Purchase = mongoose.model("Purchase", purchaseSchema);
