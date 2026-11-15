import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  entity: {
    type: String,
    required: true,
    trim: true,
  },
  year: {
    type: Number,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

counterSchema.index({ entity: 1, year: 1 }, { unique: true });

export const Counter = mongoose.model("Counter", counterSchema);
