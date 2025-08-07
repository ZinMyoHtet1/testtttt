const express = require("express");
const CONTROLLER = require("./../controllers/telegramController");
const route = express.Router();

route.post("/sendMessage", CONTROLLER.sendMessage);
route.get("/getMessage/:messageId", CONTROLLER.getMessage);
route.get("/sendDocument", CONTROLLER.sendDocument);
route.get("/getDocument/:fileId", CONTROLLER.getDocument);

module.exports = route;
