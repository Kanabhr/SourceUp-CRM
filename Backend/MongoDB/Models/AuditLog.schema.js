import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  action: {
    type: String,
    required: true,
    trim: true,
  },
  entity: {
    type: String,
    required: true,
    trim: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
