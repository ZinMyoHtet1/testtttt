const express = require("express");
const cors = require("cors");
const app = express();

const connectToMongoDb = require("./helpers/init_mongoose");

const PORT = process.env.PORT || 4040;

app.use(cors());
app.use(express.json());

connectToMongoDb();

const server = app.listen(PORT, () => {
  console.log(`your server is running on port ${PORT}`);
});

process.on("unhandleRejection", function () {
  console.log("UnhandleRejection Occuring...");
  server.close(() => process.exit(1));
});

module.exports = { app, server };
