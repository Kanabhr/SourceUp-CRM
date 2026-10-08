import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    console.log("Error while connection to MongoDB !", error);
    process.exit(1);
  }
};

export default connectDB;
