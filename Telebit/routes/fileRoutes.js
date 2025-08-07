const express = require("express");
const CONTROLLER = require("./../controllers/fileController");
const route = express.Router();

route.get("/find", CONTROLLER.find);
route.post("/upload", CONTROLLER.upload);
route.get("/download/:token", CONTROLLER.downloadFile);
route.get("/watch/:token", CONTROLLER.watchFile);
route.get("/rename/:uploadId", CONTROLLER.renameFile);
route.get("/delete/:uploadId", CONTROLLER.deleteFile);
route.get("/:uploadId", CONTROLLER.findWithUploadId);

module.exports = route;
