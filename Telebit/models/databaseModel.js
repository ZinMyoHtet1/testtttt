const mongoose = require("mongoose");

const databaseSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  file: {
    type: Object,
    required: true,
  },
  directory: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("Database", databaseSchema);
