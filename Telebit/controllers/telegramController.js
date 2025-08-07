const Telegram = require("../utils/Telegram");

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;
const CHAT_ID = +process.env.CHAT_ID;
const bot = new Telegram(TELEGRAM_BOT_API);

const sendMessage = async (req, res) => {
  try {
    const form = req.body;
    console.log(form, "form");
    if (!form && !form.data) {
      const error = new Error("Not valid form");
      error.statusCode = 400;
      throw error;
    }
    const message =
      typeof form.data === "string" ? form.data : JSON.parse(form.data);

    const result = await bot.sendMessage(CHAT_ID, message);
    // await bot.getAllMessages();
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const getMessage = async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const result = await bot.getMessage(CHAT_ID, +messageId);
    // await bot.getAllMessages();
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const sendDocument = async (req, res) => {
  try {
    const result = await bot.sendDocument(
      CHAT_ID, // Replace with real chat ID
      Buffer.from(
        JSON.stringify({
          createAt: Date.now(),
          data: [],
        }),
        "utf8"
      ),
      "text/plain",
      "document.txt"
    );
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
};

const getDocument = async (req, res) => {
  try {
    const fileId = req.params.fileId;

    if (!fileId) {
      throw new Error("no fileId found", { statusCode: 400 });
    }
    const result = await bot.getDocument(fileId);

    res.status(200).json({
      status: "success",
      data: JSON.parse(result.toString("utf8")),
    });
  } catch (error) {
    res.status(error.statusCode).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = { sendMessage, getMessage, sendDocument, getDocument };
