import mongoose from "mongoose";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const QUOTATION_CURRENCIES = ["INR", "CNY", "USD"];

// ─── Main schema ────────────────────────────────────────────────────────────

const quotationSchema = new mongoose.Schema(
  {
    quotationId: {
      type: String,
      unique: true,
      sparse: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead reference is required"],
    },
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      default: null,
    },
    vendorRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    vendorName: {
      type: String,
      trim: true,
      default: "",
    },
    product: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      enum: QUOTATION_CURRENCIES,
      default: "INR",
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    validity: {
      type: Date,
      default: null,
    },
    terms: {
      type: String,
      trim: true,
      default: "",
    },
    fileUrl: {
      type: String,
      default: "",
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator reference is required"],
    },
  },
  { timestamps: true },
);

// Indexes
quotationSchema.index({ leadId: 1 });
quotationSchema.index({ dealId: 1 });
quotationSchema.index({ vendorRef: 1 });

export const Quotation = mongoose.model("Quotation", quotationSchema);
