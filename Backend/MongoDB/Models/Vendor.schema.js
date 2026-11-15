import mongoose from "mongoose";
import { generateVendorId } from "../../Utils/generateId.js";

export const VENDOR_CATEGORIES = [
  "Packaging",
  "Electronics",
  "Apparel",
  "Plastics",
  "Metals",
  "Other",
];

export const VENDOR_COUNTRIES = ["India", "China", "Other"];
export const VENDOR_STATUSES = ["Active", "Inactive"];

const vendorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      unique: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    country: {
      type: String,
      enum: {
        values: VENDOR_COUNTRIES,
        message: "{VALUE} is not a supported country",
      },
      default: "India",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    factoryAddress: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: {
        values: VENDOR_CATEGORIES,
        message: "{VALUE} is not a valid vendor category",
      },
      default: "Other",
    },
    products: {
      type: [String],
      default: [],
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: "",
    },
    bankDetails: {
      beneficiaryName: { type: String, trim: true, default: "" },
      bankName:        { type: String, trim: true, default: "" },
      accountNo:       { type: String, trim: true, default: "" },
      ifscOrSwift:     { type: String, trim: true, default: "" },
      branch:          { type: String, trim: true, default: "" },
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: VENDOR_STATUSES,
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (avoid duplicating single-field index on vendorId which has unique: true)
vendorSchema.index({ country: 1, category: 1 });
vendorSchema.index({ status: 1 });
vendorSchema.index({ companyName: "text", contactPerson: "text" });

// Pre-save hook: auto-assign SUI-V- ID if not set
vendorSchema.pre("save", async function (next) {
  if (this.isNew && !this.vendorId) {
    this.vendorId = await generateVendorId();
  }
  next();
});

export const Vendor = mongoose.model("Vendor", vendorSchema);
