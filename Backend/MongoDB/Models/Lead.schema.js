import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    remark: {
      type: String,
      default: "",
    },
  },
  { _id: true },
);

const LEAD_STATUSES = ["Open", "In Progress", "Quotation Sent", "Closed Won", "Closed Lost"];
const LEAD_SOURCES = ["Website", "Phone", "Referral", "Other"];
const VERIFICATION_STATUSES = ["Unverified", "Verified", "Fraud"];

// Valid forward transitions — prevents arbitrary status jumps
const STATUS_TRANSITIONS = {
  Open: ["In Progress", "Closed Lost"],
  "In Progress": ["Quotation Sent", "Closed Lost"],
  "Quotation Sent": ["Closed Won", "Closed Lost"],
  "Closed Won": [],
  "Closed Lost": [],
};

const leadSchema = new mongoose.Schema(
  {
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
      default: "",
    },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    // Designation of Contact Person (from Excel import)
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    productNeeded: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: LEAD_SOURCES,
      default: "Other",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // City / State (from Excel import)
    location: {
      type: String,
      trim: true,
      default: "",
    },
    // Website URL or Instagram handle (used by AI verification)
    websiteUrl: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "Open",
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: "Unverified",
    },
    verificationRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Required — cannot be 0 or empty
    costPerLead: {
      type: Number,
      required: true,
      min: [0.01, "Cost per lead must be greater than 0"],
    },
    // Populated when status = Closed Won
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      default: null,
    },
    notes: [noteSchema],
    statusHistory: [statusHistorySchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes for search + filter performance
leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdBy: 1 });
leadSchema.index({ date: -1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ clientName: "text", company: "text", productNeeded: "text", location: "text" });

export { LEAD_STATUSES, LEAD_SOURCES, VERIFICATION_STATUSES, STATUS_TRANSITIONS };
export const Lead = mongoose.model("Lead", leadSchema);
