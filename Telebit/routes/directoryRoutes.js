const express = require("express");
const CONTROLLER = require("./../controllers/directoryController");
const route = express.Router();

route.get("/createDirectoryDB", CONTROLLER.createDirectoryDB);
route.get("/find", CONTROLLER.find);
route.post("/create", CONTROLLER.create);
route.get("/:dirId", CONTROLLER.findById);
// route.get("/sendDocument", CONTROLLER.sendDocument);
// route.get("/getDocument/:fileId", CONTROLLER.getDocument);

module.exports = route;
