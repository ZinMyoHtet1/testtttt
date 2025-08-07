const express = require("express");
const cors = require("cors");
const app = express();

const PORT = process.env.PORT || 4040;

app.use(cors());
app.use(express.json());

const server = app.listen(PORT, () => {
  console.log(`your server is running on port ${PORT}`);
});

module.exports = { app, server };
