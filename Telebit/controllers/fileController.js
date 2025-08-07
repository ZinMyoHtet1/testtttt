const busboy = require("busboy");

const { server } = require("../app.js");

const Database = require("../utils/Database");
const Directory = require("../utils/Directory");
const Telegram = require("../utils/Telegram");
const WebSocket = require("../utils/WebSocket.js");
const JWT = require("../utils/JWT");

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;
const CHAT_ID = +process.env.CHAT_ID;
const db = new Database(TELEGRAM_BOT_API, CHAT_ID);
const directory = new Directory(TELEGRAM_BOT_API, CHAT_ID);
const bot = new Telegram(TELEGRAM_BOT_API);
const jwt = new JWT();
const webSocket = new WebSocket();

webSocket.connect(server);

const find = async (req, res) => {
  try {
    const type = req.query.type;
    const userId = req.headers.userid;
    const database = await db.getDatabseWithUserId(userId);

    const result = await bot.getDocument(database.fileId); // Make sure this returns a Buffer or file content
    let files = JSON.parse(result.toString("utf8"));

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
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const findWithUploadId = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const uploadId = req.params.uploadId;

    const database = await db.getDatabseWithUserId(userId);
    await db.connect(database);
    const file = await db.findWithUploadId(uploadId);
    const payload = { uploadId, userId };

    const token = jwt.sign(payload);
    file.fileId ? delete file.fileId : delete file.fileIds;

    const hostname = process.env.HOST || "http://localhost:4040";

    const downloadURL = `${hostname}/files/download/${token}`;

    const result = { ...file, download: downloadURL };
    if (
      file.mimeType.startsWith("video") ||
      file.mimeType.startsWith("image")
    ) {
      result.watch = `${hostname}/files/watch/${token}`;
    }

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
      error: error.stack,
    });
  }
};

const downloadFile = async (req, res) => {
  try {
    const token = req.params.token;
    const decodedToken = jwt.verify(token);

    const { uploadId, userId } = decodedToken;

    const database = await db.getDatabseWithUserId(userId);
    await db.connect(database);
    const file = await db.findWithUploadId(uploadId);
    const { filename, fileIds, mimeType, size, fileId } = file;

    const safeFilename = encodeURIComponent(filename);

    if (fileId) {
      res.writeHead(200, {
        "Content-Length": size,
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      });

      const buffer = await db.readFileSingle(fileId);

      res.write(buffer);
      res.end();
    } else {
      const sortedFileIds = fileIds
        .sort((a, b) => a.number - b.number)
        .map((item) => item.fileId);

      const stream = await db.readFile(sortedFileIds);

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
  } catch (error) {
    console.error("Error in watchFile:", error);
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const watchFile = async (req, res) => {
  try {
    const token = req.params.token;
    const decodedToken = jwt.verify(token);

    const { uploadId, userId } = decodedToken;

    const database = await db.getDatabseWithUserId(userId);
    await db.connect(database);
    const file = await db.findWithUploadId(uploadId);
    const { filename, fileIds, mimeType, size, fileId } = file;
    // console.log(file, "file");
    if (fileId) {
      res.writeHead(200, {
        "Content-Length": size,
        "Content-Type": mimeType,
      });

      const buffer = await db.readFileSingle(fileId);
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
      const buffer = await db.readFileSingle(sortedFileIds[fileIndex]);

      res.write(buffer);
      res.end();
    }
  } catch (error) {
    console.error("Error in watchFile:", error);
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

// const upload = async (req, res) => {
//   const userId = req.headers.userid;

//   const database = await db.getDatabseWithUserId(userId);
//   const bb = busboy({ headers: req.headers });

//   const CHUNK_SIZE = 500 * 1024; // 500KB
//   let currentBuffer = Buffer.alloc(0);
//   let meta = {};
//   const fileIds = [];
//   let fileId;
//   let chunkNumber = 0;

//   let uploadPromises = [];

//   bb.on("file", (_, file, info) => {
//     const { filename, mimeType } = info;

//     meta.mimeType = mimeType;
//     const chunks = [];

//     file.on("data", (chunk) => {
//       if (+meta.size <= CHUNK_SIZE) {
//         chunks.push(chunk);
//       } else {
//         currentBuffer = Buffer.concat([currentBuffer, chunk]);

//         while (currentBuffer.length >= CHUNK_SIZE) {
//           chunkNumber++;
//           const chunkToProcess = currentBuffer.slice(0, CHUNK_SIZE);
//           currentBuffer = currentBuffer.slice(CHUNK_SIZE);

//           const data = { chunkToProcess, number: chunkNumber };
//           // Push a promise to the upload queue
//           uploadPromises.push(
//             bot
//               .sendDocument(CHAT_ID, data.chunkToProcess, mimeType, filename)
//               .then((result) => {
//                 fileIds.push({ fileId: result.fileId, number: data.number });
//               })
//           );
//         }
//       }
//     });

//     file.on("end", () => {
//       // Push remaining data if exists
//       if (chunks.length) {
//         const buffer = Buffer.concat(chunks);
//         uploadPromises.push(
//           bot
//             .sendDocument(CHAT_ID, buffer, mimeType, filename)
//             .then((result) => {
//               fileId = result.fileId;
//             })
//         );

//         return;
//       }
//       chunkNumber++;
//       const data = { currentBuffer, number: chunkNumber };

//       if (currentBuffer.length > 0) {
//         uploadPromises.push(
//           bot
//             .sendDocument(CHAT_ID, data.currentBuffer, mimeType, filename)
//             .then((result) => {
//               fileIds.push({ fileId: result.fileId, number: data.number });
//             })
//         );
//       }
//     });
//   });

//   bb.on("field", (name, val) => {
//     meta[name] = val;
//   });

//   bb.on("close", async () => {
//     try {
//       await Promise.all(uploadPromises);

//       if (fileIds.length) {
//         meta.fileIds = fileIds;
//       }

//       if (fileId) {
//         meta.fileId = fileId;
//       }
//       console.log(meta.fileId, "mta fileid");
//       meta.createdAt = Date.now();
//       meta.updatedAt = Date.now();

//       // Optional: Save to pseudo DB here
//       await db.connect(database);
//       const result = await db.create(meta);

//       db.writeFileSync(userId, result);

//       res.status(200).json({
//         status: "success",
//         message: "Uploaded in chunks",
//         data: meta,
//       });
//     } catch (err) {
//       console.error(err);
//       res.status(500).json({
//         status: "fail",
//         message: err.message,
//       });
//     }
//   });

//   req.pipe(bb);
// };

// const upload = async (req, res) => {
//   const userId = req.headers.userid;
//   const database = await db.getDatabseWithUserId(userId);
//   const bb = busboy({ headers: req.headers });

//   const totalSize = parseInt(req.headers["content-length"]);
//   let uploadedBytes = 0;

//   const CHUNK_SIZE = 500 * 1024; // 500KB
//   let currentBuffer = Buffer.alloc(0);
//   let meta = {};
//   const fileIds = [];
//   let fileId;
//   let chunkNumber = 0;

//   let uploadPromises = [];

//   bb.on("file", (_, file, info) => {
//     const { filename, mimeType } = info;
//     meta.mimeType = mimeType;
//     meta.filename = filename;

//     const chunks = [];

//     file.on("data", (chunk) => {
//       if (+meta.size <= CHUNK_SIZE) {
//         chunks.push(chunk);
//       } else {
//         currentBuffer = Buffer.concat([currentBuffer, chunk]);

//         while (currentBuffer.length >= CHUNK_SIZE) {
//           chunkNumber++;
//           const chunkToProcess = currentBuffer.slice(0, CHUNK_SIZE);
//           currentBuffer = currentBuffer.slice(CHUNK_SIZE);

//           const data = { chunkToProcess, number: chunkNumber };
//           uploadPromises.push(
//             bot
//               .sendDocument(CHAT_ID, data.chunkToProcess, mimeType, filename)
//               .then((result) => {
//                 fileIds.push({ fileId: result.fileId, number: data.number });
//                 uploadedBytes += data.chunkToProcess.length;
//                 const percent = Math.floor((uploadedBytes / totalSize) * 100);
//                 console.log("Upload Progress:", percent + "%");
//               })
//           );
//         }
//       }
//     });

//     file.on("end", () => {
//       if (chunks.length) {
//         const buffer = Buffer.concat(chunks);
//         uploadPromises.push(
//           bot
//             .sendDocument(CHAT_ID, buffer, mimeType, filename)
//             .then((result) => {
//               fileId = result.fileId;
//             })
//         );
//         return;
//       }

//       chunkNumber++;
//       const data = { currentBuffer, number: chunkNumber };

//       if (currentBuffer.length > 0) {
//         uploadPromises.push(
//           bot
//             .sendDocument(CHAT_ID, data.currentBuffer, mimeType, filename)
//             .then((result) => {
//               fileIds.push({ fileId: result.fileId, number: data.number });
//             })
//         );
//       }
//     });
//   });

//   bb.on("field", (name, val) => {
//     meta[name] = val;
//   });

//   bb.on("close", async () => {
//     try {
//       await Promise.all(uploadPromises);

//       if (fileIds.length) {
//         meta.fileIds = fileIds;
//       }

//       if (fileId) {
//         meta.fileId = fileId;
//       }

//       meta.createdAt = Date.now();
//       meta.updatedAt = Date.now();

//       await db.connect(database);
//       const result = await db.create(meta);

//       db.writeFileSync(userId, result);

//       res.status(200).json({
//         status: "success",
//         message: "Uploaded in chunks",
//         data: meta,
//       });
//     } catch (err) {
//       console.error(err);
//       res.status(500).json({
//         status: "fail",
//         message: err.message,
//       });
//     }
//   });

//   req.pipe(bb);
// };

const upload = async (req, res) => {
  const userId = req.headers.userid;
  const parentId = req.query.directory || "root";
  const uploadSessionId = req.headers["uploadsessionid"];
  const database = await db.getDatabseWithUserId(userId);
  const directoryDB = await directory.getDirectoryDBWithUserId(userId);
  const bb = busboy({ headers: req.headers });

  // const rootDirectory = await directory.findById(rootId);

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

                // // Send progress via WebSocket if available
                // const ws = uploadSessions.get(uploadSessionId);
                // // console.log(ws, uploadSessionId);
                // if (ws && ws.readyState === 1) {
                //   ws.send(JSON.stringify({ percent }));
                // }
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

      await db.connect(database);
      const fileResult = await db.create(meta);

      await directory.connect(directoryDB);
      const directoryResult = await directory.addFileToDirectory(
        parentId,
        meta.uploadId
      );

      db.writeFileSync(userId, fileResult);
      directory.writeFileSync(userId, directoryResult);

      res.status(200).json({
        status: "success",
        message: "Uploaded in chunks",
        data: meta,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        status: "fail",
        message: err.message,
      });
    }
  });

  req.pipe(bb);
};
const renameFile = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const uploadId = req.params.uploadId;
    const filename = req.query.filename;

    if (!filename) {
      const error = new Error("filename not found");
      error.statusCode = 400;
      throw error;
    }

    const database = await db.getDatabseWithUserId(userId);
    await db.connect(database);
    const safeFilename = encodeURIComponent(filename);
    const { result, file } = await db.renameFileByUploadId(
      uploadId,
      safeFilename
    );
    db.writeFileSync(userId, result);
    res.status(200).json({
      status: "success",
      data: file,
      message: "successfully updated new filename",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

const deleteFile = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const uploadId = req.params.uploadId;

    const database = await db.getDatabseWithUserId(userId);
    await db.connect(database);
    const result = await db.deleteFileByUploadId(uploadId);
    db.writeFileSync(userId, result);
    res.status(200).json({
      status: "success",
      message: "successfully deleted file",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "fail",
      message: error.message,
    });
  }
};

module.exports = {
  find,
  findWithUploadId,
  downloadFile,
  watchFile,
  upload,
  renameFile,
  deleteFile,
};
