const busboy = require("busboy");

const { server } = require("../app.js");

const File = require("../utils/File.js");
const Directory = require("../utils/Directory");
const Telegram = require("../utils/Telegram");
const WebSocket = require("../utils/WebSocket.js");
const asyncErrorHandler = require("../utils/asyncErrorHandler.js");
const JWT = require("../utils/JWT");
const CustomError = require("../utils/CustomError.js");

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;
const CHAT_ID = +process.env.CHAT_ID;
const file = new File(TELEGRAM_BOT_API, CHAT_ID);
const directory = new Directory(TELEGRAM_BOT_API, CHAT_ID);
const bot = new Telegram(TELEGRAM_BOT_API);
const jwt = new JWT();
const webSocket = new WebSocket();

webSocket.connect(server);

const find = asyncErrorHandler(async function (req, res, next) {
  const type = req.query.type;
  const userId = req.headers.userid;
  const database = await file.getDatabaseWithUserId(userId);

  await file.connect(database);
  let files = await file.find();

  files.map((file) => {
    delete file.fileIds;
    delete file.fileId;
    return file;
  });

  if ((type && type === "video") || type === "image") {
    files = files.filter((file) => file.mimeType.startsWith(type));
  }

  if (type && type === "document") {
    files = files.filter(
      (file) => !["video", "image"].includes(file.mimeType.split("/")[0])
    );
  }

  res.status(200).json({
    status: "success",
    data: files,
  });
});

const findWithUploadId = asyncErrorHandler(async function (req, res, next) {
  const userId = req.headers.userid;
  const uploadId = req.params.uploadId;

  const database = await file.getDatabaseWithUserId(userId);
  await file.connect(database);
  const targetFile = await file.findWithUploadId(uploadId);
  const payload = { uploadId, userId };

  const token = jwt.sign(payload);
  targetFile.fileId ? delete targetFile.fileId : delete targetFile.fileIds;

  const hostname = process.env.HOST || "http://localhost:4040";
  const downloadURL = `${hostname}/files/download/${token}`;

  const result = { ...targetFile, download: downloadURL };
  if (
    targetFile.mimeType.startsWith("video") ||
    targetFile.mimeType.startsWith("image")
  ) {
    result.watch = `${hostname}/files/watch/${token}`;
  }

  res.status(200).json({
    status: "success",
    data: result,
  });
});

const downloadFile = asyncErrorHandler(async function (req, res) {
  const token = req.params.token;
  const decodedToken = jwt.verify(token);

  const { uploadId, userId } = decodedToken;

  const database = await file.getDatabaseWithUserId(userId);
  await file.connect(database);
  const targetFile = await file.findWithUploadId(uploadId);
  const { filename, fileIds, mimeType, size, fileId } = targetFile;

  const safeFilename = encodeURIComponent(filename);

  if (fileId) {
    res.writeHead(200, {
      "Content-Length": size,
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    });

    const buffer = await file.readFileSingle(fileId);

    res.write(buffer);
    res.end();
  } else {
    const sortedFileIds = fileIds
      .sort((a, b) => a.number - b.number)
      .map((item) => item.fileId);

    const stream = await file.readFile(sortedFileIds);

    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": size,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    });

    stream.on("data", (chunk) => res.write(chunk));
    stream.on("end", () => res.end());
    stream.on("error", (err) => {
      console.error("Stream error:", err);
      res.status(500).end("Stream failed");
    });
  }
});

const watchFile = asyncErrorHandler(async function (req, res) {
  const token = req.params.token;
  const decodedToken = jwt.verify(token);

  const { uploadId, userId } = decodedToken;

  const database = await file.getDatabaseWithUserId(userId);
  await file.connect(database);
  const targetFile = await file.findWithUploadId(uploadId);
  const { filename, fileIds, mimeType, size, fileId } = targetFile;

  if (fileId) {
    res.writeHead(200, {
      "Content-Length": size,
      "Content-Type": mimeType,
    });

    const buffer = await file.readFileSingle(fileId);
    res.write(buffer);
    res.end();
  } else {
    const sortedFileIds = fileIds
      .sort((a, b) => a.number - b.number)
      .map((item) => item.fileId);

    const CHUNK_SIZE = 500 * 1024; // 500KB
    const range = req.headers.range || "bytes=0-";

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;

    if (start >= size) {
      res.status(416).send("Requested range not satisfiable");
      return;
    }

    const contentLength = end - start + 1;
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength,
      "Content-Type": mimeType,
    });

    const fileIndex = start < CHUNK_SIZE ? 0 : Math.floor(start / CHUNK_SIZE);
    const buffer = await file.readFileSingle(sortedFileIds[fileIndex]);

    res.write(buffer);
    res.end();
  }
});

const upload = asyncErrorHandler(async function (req, res, next) {
  const userId = req.headers.userid;
  const parentId = req.query.directory;

  if (!parentId) return next(new CustomError("directory misssing", 400));

  const uploadSessionId = req.headers["uploadsessionid"];
  const fileDB = await file.getDatabaseWithUserId(userId);
  const directoryDB = await directory.getDatabaseWithUserId(userId);

  await directory.connect(directoryDB);
  await file.connect(fileDB);
  await directory.findById(parentId);

  const bb = busboy({ headers: req.headers });
  const totalSize = parseInt(req.headers["content-length"]);
  let uploadedBytes = 0;

  const CHUNK_SIZE = 500 * 1024; // 500KB
  let currentBuffer = Buffer.alloc(0);
  let meta = {};
  const fileIds = [];
  let fileId;
  let chunkNumber = 0;

  let uploadPromises = [];

  bb.on("file", (_, file, info) => {
    const { filename, mimeType } = info;
    meta.mimeType = mimeType;
    meta.filename = filename;

    const chunks = [];

    file.on("data", (chunk) => {
      if (+meta.size <= CHUNK_SIZE) {
        chunks.push(chunk);
      } else {
        currentBuffer = Buffer.concat([currentBuffer, chunk]);

        while (currentBuffer.length >= CHUNK_SIZE) {
          chunkNumber++;
          const chunkToProcess = currentBuffer.slice(0, CHUNK_SIZE);
          currentBuffer = currentBuffer.slice(CHUNK_SIZE);

          const data = { chunkToProcess, number: chunkNumber };
          uploadPromises.push(
            bot
              .sendDocument(CHAT_ID, data.chunkToProcess, mimeType, filename)
              .then((result) => {
                fileIds.push({ fileId: result.fileId, number: data.number });
                uploadedBytes += data.chunkToProcess.length;
                const percent = Math.floor((uploadedBytes / totalSize) * 100);

                webSocket.send(uploadSessionId, { percent });
              })
          );
        }
      }
    });

    file.on("end", () => {
      if (chunks.length) {
        const buffer = Buffer.concat(chunks);
        uploadPromises.push(
          bot
            .sendDocument(CHAT_ID, buffer, mimeType, filename)
            .then((result) => {
              fileId = result.fileId;
            })
        );
        return;
      }

      chunkNumber++;
      const data = { currentBuffer, number: chunkNumber };

      if (currentBuffer.length > 0) {
        uploadPromises.push(
          bot
            .sendDocument(CHAT_ID, data.currentBuffer, mimeType, filename)
            .then((result) => {
              fileIds.push({ fileId: result.fileId, number: data.number });
            })
        );
      }
    });
  });

  bb.on("field", (name, val) => {
    meta[name] = val;
  });

  bb.on("close", async () => {
    try {
      await Promise.all(uploadPromises);

      if (fileIds.length) {
        meta.fileIds = fileIds;
      }

      if (fileId) {
        meta.fileId = fileId;
      }

      meta.createdAt = Date.now();
      meta.updatedAt = Date.now();

      const fileResult = await file.create(meta);
      const directoryResult = await directory.addFileToDirectory(
        parentId,
        meta.uploadId
      );

      await file.updateFileDB(userId, fileResult);
      await directory.updateDirectoryDB(userId, directoryResult);

      res.status(200).json({
        status: "success",
        message: "Uploaded in chunks",
        data: meta,
      });
    } catch (err) {
      next(err);
    }
  });

  req.pipe(bb);
});

const renameFile = asyncErrorHandler(async function (req, res) {
  const userId = req.headers.userid;
  const uploadId = req.params.uploadId;
  const filename = req.query.name;

  if (!filename) throw new CustomError("filename not found", 400);

  const database = await file.getDatabaseWithUserId(userId);
  await file.connect(database);
  const safeFilename = encodeURIComponent(filename);
  const { result, file: responseFile } = await file.renameFileByUploadId(
    uploadId,
    safeFilename
  );

  await file.updateFileDB(userId, result);
  res.status(200).json({
    status: "success",
    data: responseFile,
    message: "successfully updated new filename",
  });
});

const deleteFile = asyncErrorHandler(async function (req, res, next) {
  const userId = req.headers.userid;
  const uploadId = req.params.uploadId;
  const parentId = req.query.directory;

  if (!parentId) return next(new CustomError("directory missing", 400));

  const fileDB = await file.getDatabaseWithUserId(userId);
  const directoryDB = await directory.getDatabaseWithUserId(userId);

  await file.connect(fileDB);
  await directory.connect(directoryDB);

  const targetDirectory = await directory.findById(parentId);
  const doesExist = targetDirectory.files.includes(uploadId);

  if (!doesExist)
    return next(new CustomError("this file does not exist in directory", 404));

  const result = await file.deleteFileByUploadId(uploadId);

  await file.updateFileDB(userId, result);
  const directoryResult = await directory.removeFileFromDirectory(
    parentId,
    uploadId
  );
  await directory.updateDirectoryDB(userId, directoryResult);

  res.status(200).json({
    status: "success",
    message: "successfully deleted file",
  });
});

module.exports = {
  find,
  findWithUploadId,
  downloadFile,
  watchFile,
  upload,
  renameFile,
  deleteFile,
};
