require("dotenv").config();
const { app } = require("./app.js");

const File = require("./utils/File.js");
const Directory = require("./utils/Directory");
const globalErrorHandler = require("./utils/globalErrorHandler");
const asyncErrorHandler = require("./utils/asyncErrorHandler");

const fileRoutes = require("./routes/fileRoutes");
const telegramRoutes = require("./routes/telegramRoutes");
const directoryRoutes = require("./routes/directoryRoutes");

const DatabaseModel = require("./models/databaseModel");
const CustomError = require("./utils/CustomError.js");

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;
const CHAT_ID = +process.env.CHAT_ID;
const file = new File(TELEGRAM_BOT_API, CHAT_ID);
const directory = new Directory(TELEGRAM_BOT_API, CHAT_ID);

app.get("/", (req, res) => {
  res.send("Welcome from my web");
});

app.use("/files", fileRoutes);
app.use("/telegram", telegramRoutes);
app.use("/directories", directoryRoutes);

app.get(
  "/addUser",
  asyncErrorHandler(async function (req, res, next) {
    const userId = req.headers.userid;
    if (!userId) return next(new CustomError("userId missing", 400));
    const doesExist = await DatabaseModel.findOne({ userId: userId });
    if (doesExist)
      return next(new CustomError("this userId has already existed!", 409));

    const fileDB = await file.createFileDB();
    const directoryDB = await directory.createDirectoryDB();
    const user = await DatabaseModel.create({
      userId,
      file: fileDB,
      directory: directoryDB,
    });
    res.status(200).json({
      status: "success",
      data: user,
    });
  })
);

app.all("/{*any}", (req, res, next) => {
  const error = new CustomError(`Route "${req.originalUrl} is not found`, 404);
  next(error);
});

app.use(globalErrorHandler);
