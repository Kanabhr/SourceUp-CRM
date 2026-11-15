import mongoose from "mongoose";

// ─── Enums ──────────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  "Quotation Sent", "Negotiation", "Sample",
  "Won", "Advance Received", "In Production",
  "Dispatched", "Delivered", "Closed", "Lost",
];

const COMMISSION_STATUSES = ["Pending", "Paid"];

const BALANCE_DUE_TRIGGERS = ["Dispatch", "Reaching India"];

// Valid forward and recovery transitions
const DEAL_STAGE_TRANSITIONS = {
  "Quotation Sent":   ["Negotiation", "Sample", "Won", "Lost"],
  "Negotiation":      ["Sample", "Won", "Lost"],
  "Sample":           ["Negotiation", "Won", "Lost"],
  "Won":              ["Advance Received", "Lost"],
  "Advance Received": ["In Production", "Lost"],
  "In Production":    ["Dispatched", "Lost"],
  "Dispatched":       ["Delivered", "Lost"],
  "Delivered":        ["Closed"],
  "Closed":           [],
  "Lost":             ["Quotation Sent", "Negotiation"],
};

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const stageHistorySchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, default: Date.now },
    remark: { type: String, default: "" },
  },
  { _id: true },
);

// ─── Main schema ────────────────────────────────────────────────────────────

const dealSchema = new mongoose.Schema(
  {
    dealId: {
      type: String,
      unique: true,
      sparse: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead reference is required"],
    },
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    salesRep: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Quotation / Invoice
    quotationNo: { type: String, trim: true, default: "" },
    quotationDate: { type: Date, default: null },
    piNo: { type: String, trim: true, default: "" },
    invoiceNo: { type: String, trim: true, default: "" },

    // Pricing
    sellingPricePerUnit: { type: Number, default: 0 },
    qty: { type: Number, default: 0 },
    orderValue: { type: Number, default: 0 },           // auto = sellingPrice * qty

    // Cost (populated from Purchase)
    buyingCost: { type: Number, default: 0 },
    landedCost: { type: Number, default: 0 },

    // Profit
    grossProfit: { type: Number, default: 0 },           // auto = orderValue - landedCost * qty
    grossProfitPct: { type: Number, default: 0 },        // auto

    // Commission
    commissionPct: { type: Number, default: 20 },
    commissionAmount: { type: Number, default: 0 },      // auto = GP * commissionPct/100
    commissionStatus: {
      type: String,
      enum: COMMISSION_STATUSES,
      default: "Pending",
    },

    // Sample tracking
    sample: {
      required: { type: Boolean, default: false },
      sentDate: { type: Date, default: null },
      approved: { type: Boolean, default: false },
    },

    // Payment
    advance: {
      amount: { type: Number, default: 0 },
      receivedDate: { type: Date, default: null },
    },
    balance: {
      amount: { type: Number, default: 0 },
      dueTrigger: { type: String, enum: [...BALANCE_DUE_TRIGGERS, ""], default: "" },
      receivedDate: { type: Date, default: null },
    },

    // Dates
    orderConfirmDate: { type: Date, default: null },
    expectedDelivery: { type: Date, default: null },
    actualDelivery: { type: Date, default: null },

    // Stage pipeline
    stage: {
      type: String,
      enum: DEAL_STAGES,
      default: "Quotation Sent",
    },
    stageHistory: [stageHistorySchema],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes
dealSchema.index({ stage: 1 });
dealSchema.index({ salesRep: 1 });
dealSchema.index({ leadId: 1 });
dealSchema.index({ createdBy: 1 });

export { DEAL_STAGES, COMMISSION_STATUSES, BALANCE_DUE_TRIGGERS, DEAL_STAGE_TRANSITIONS };
export const Deal = mongoose.model("Deal", dealSchema);
