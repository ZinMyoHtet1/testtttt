const path = require("path");

require("dotenv").config();
const { app } = require("./app.js");

const Database = require("./utils/Database");
const fileRoutes = require("./routes/fileRoutes.js");
const telegramRoutes = require("./routes/telegramRoutes.js");
const directoryRoutes = require("./routes/directoryRoutes.js");
const writeFileSync = require("./utils/writeFileSync.js");

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;
const CHAT_ID = +process.env.CHAT_ID;
const db = new Database(TELEGRAM_BOT_API, CHAT_ID);

app.get("/", (req, res) => {
  res.send("Welcome from my web");
});

app.use("/files", fileRoutes);
app.use("/telegram", telegramRoutes);
app.use("/directory", directoryRoutes);

app.get("/createDatabase", async (req, res) => {
  try {
    const userId = req.headers.userid;

    const result = await db.createDatabase();
    writeFileSync(userId, result, path.join(__dirname, "./db/user.json"));

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode).json({
      status: "fail",
      message: error.message,
    });
  }
});

// const server = app.listen(PORT, () => {
//   console.log(`your server is running on port ${PORT}`);
// });

// module.exports = webSocket.connect(server);
// const wss = new WebSocket.Server({ server });

// wss.on("connection", (ws, req) => {
//   console.log("on connection");

//   ws.on("message", (msg) => {
//     try {
//       const { uploadSessionId } = JSON.parse(msg);
//       if (uploadSessionId) {
//         uploadSessions.set(uploadSessionId, ws);
//       }
//       console.log("on message");
//     } catch (err) {
//       console.error("Invalid WebSocket message");
//     }
//   });

//   ws.on("close", () => {
//     for (const [key, client] of uploadSessions.getStorage().entries()) {
//       if (client === ws) uploadSessions.delete(key);
//     }
//   });
// });

// console.log(uploadSessions, "from server");

// module.exports = webSocket;

// module.exports = server;
