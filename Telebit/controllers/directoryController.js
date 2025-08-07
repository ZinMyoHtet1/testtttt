const CustomError = require("../utils/CustomError");
const Directory = require("../utils/Directory");
const asyncErrorHandler = require("../utils/asyncErrorHandler");

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;
const CHAT_ID = +process.env.CHAT_ID;

const directory = new Directory(TELEGRAM_BOT_API, CHAT_ID);

const create = asyncErrorHandler(async function (req, res, next) {
  const { name, parentId } = req.body;
  if (!name || !parentId)
    return next(new CustomError("bad request: no name or no parentId", 400));

  const userId = req.headers.userid;
  const directoryDB = await directory.getDatabaseWithUserId(userId);

  await directory.connect(directoryDB);
  const { result, directory: data } = await directory.create(name, parentId);

  await directory.updateDirectoryDB(userId, result);
  res.status(200).json({
    status: "success",
    data: data,
  });
});

const createDirectoryDB = asyncErrorHandler(async function (req, res) {
  const userId = req.headers.userid;
  await directory.getDatabaseWithUserId(userId);

  const result = await directory.createDirectoryDB();
  await directory.updateDirectoryDB(userId, result);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

const find = asyncErrorHandler(async function (req, res) {
  const userId = req.headers.userid;
  const dirDB = await directory.getDatabaseWithUserId(userId);

  await directory.connect(dirDB);

  const result = await directory.find();
  res.status(200).json({
    status: "success",
    data: result,
  });
});

const findById = asyncErrorHandler(async function (req, res) {
  const userId = req.headers.userid;
  const id = req.params.dirId;
  const dirDB = await directory.getDatabaseWithUserId(userId);

  await directory.connect(dirDB);
  const result = await directory.findById(id);
  res.status(200).json({
    status: "success",
    data: result,
  });
});

const renameDirectoryById = asyncErrorHandler(async function (req, res) {
  const userId = req.headers.userid;
  const id = req.params.dirId;
  const name = req.query.name;
  const directoryDB = await directory.getDatabaseWithUserId(userId);

  await directory.connect(directoryDB);
  const safeDirname = encodeURIComponent(name);
  const { result, directory: dir } = await directory.renameDirectoryById(
    id,
    safeDirname
  );
  await directory.updateDirectoryDB(userId, result);

  res.status(200).json({
    status: "success",
    data: dir,
  });
});

const deleteDirectoryById = asyncErrorHandler(async function (req, res) {
  const userId = req.headers.userid;
  const id = req.params.dirId;
  const directoryDB = await directory.getDatabaseWithUserId(userId);

  await directory.connect(directoryDB);
  const result = await directory.deleteDirectoryById(id);
  await directory.updateDirectoryDB(userId, result);

  res.status(200).json({
    status: "success",
    message: "successfully deleted directory",
  });
});

module.exports = {
  createDirectoryDB,
  find,
  create,
  findById,
  renameDirectoryById,
  deleteDirectoryById,
};
