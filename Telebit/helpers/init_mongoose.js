const mongoose = require("mongoose");
const CustomError = require("./../utils/CustomError");

if (!process.env.MONGO_URL) {
  console.error("MONGODB_URL environment variable is not defined.");
  throw new CustomError(
    "MONGODB_URL environment variable is not defined.",
    401
  );
}

function connectToMongodb() {
  mongoose
    .connect(process.env.MONGO_URL, {
      serverSelectionTimeoutMS: 100000, // Adjust as needed
    })
    .catch((err) => {
      console.error("Mongoose connection error:", err);
      process.exit(1);
    });

  mongoose.connection.on("connected", () => {
    console.log("Mongoose connected to database");
  });

  mongoose.connection.on("disconnected", () => {
    console.log("Mongoose disconnected from database");
    process.exit(1);
  });

  mongoose.connection.on("error", (err) => {
    console.error("Mongoose connection error:", err);
  });

  process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("Mongoose connection closed due to application termination");
    process.exit(0);
  });

  // Additional logging for debugging
  mongoose.connection.on("open", () => {
    console.log("Mongoose connection is open");
    // callback();
  });

  mongoose.connection.on("close", () => {
    console.log("Mongoose connection is closed");
  });
}

module.exports = connectToMongodb;
