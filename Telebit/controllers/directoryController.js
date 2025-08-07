const Directory = require("../utils/Directory");

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;
const CHAT_ID = +process.env.CHAT_ID;

const directory = new Directory(TELEGRAM_BOT_API, CHAT_ID);

const create = async (req, res) => {
  try {
    const { name, rootId } = req.body;
    if (!name || !rootId) {
      const error = new Error("bad request: no name or no rootId");
      error.statusCode = 400;
      throw error;
    }
    const userId = req.headers.userid;
    const dirDB = await directory.getDirectoryDBWithUserId(userId);

    await directory.connect(dirDB);
    const { result, directory: data } = await directory.create(name, rootId);
    // writeFileSync(userId, result, path.join(__dirname, "../db/user.json"));
    directory.writeFileSync(userId, result);
    res.status(200).json({
      status: "success",
      data: data,
    });
  } catch (error) {
    console.error("Error in create directory db:", error);
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const createDirectoryDB = async (req, res) => {
  try {
    const userId = req.headers.userid;
    await directory.getDirectoryDBWithUserId(userId);

    const result = await directory.createDirectoryDB();
    directory.writeFileSync(userId, result);
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Error in create directory db:", error);
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const find = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const dirDB = await directory.getDirectoryDBWithUserId(userId);

    await directory.connect(dirDB);

    const result = await directory.find();
    // writeFileSync(userId, result, path.join(__dirname, "../db/directory.json"));
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Error in create directory db:", error);
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const findById = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const id = req.params.dirId;
    const dirDB = await directory.getDirectoryDBWithUserId(userId);

    await directory.connect(dirDB);
    const result = await directory.findById(id);
    // writeFileSync(userId, result, path.join(__dirname, "../db/directory.json"));
    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    console.error("Error in create directory db:", error);
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = { createDirectoryDB, find, create, findById };
