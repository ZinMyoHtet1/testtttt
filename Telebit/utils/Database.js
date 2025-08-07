const Telegram = require("./Telegram.js");
const path = require("path");
const events = require("events");
const fs = require("fs");

const filePath = path.join(__dirname, "./../db/user.json");
const users = require(filePath);

class Database {
  constructor(api, chatId) {
    this.chatId = chatId;
    this.isConnected = false;
    this.files = null;
    this.bot = new Telegram(api);
  }

  async createDatabase() {
    const response = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(JSON.stringify([]), "utf8"),
      "text/plain",
      "telebit.txt"
    );
    return response;
  }

  async getDatabseWithUserId(userId) {
    if (!userId) {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    }

    const user = users.find((user) => user.userId === userId);

    if (!user) {
      const error = new Error("Invalid userId");
      error.statusCode = 401;
      throw error;
    }

    return user["file"];
  }

  async connect(database) {
    const result = await this.bot.getDocument(database.fileId);

    if (result) {
      this.database = database;
      this.isConnected = true;
    } else {
      throw new Error("invalid databaseId");
    }
  }

  async find() {
    if (this.isConnected) {
      let result = await this.bot.getDocument(this.database.fileId);
      result = JSON.parse(result.toString("utf8"));

      if (!result) {
        throw new Error("Database not initialized properly.");
      }
      this.files = result;
      return result;
    } else {
      console.log("need to connect database");
    }
  }

  async create(newData) {
    await this.find(); // returns { createAt, data: [...] }

    this.files.push(newData); // update the array in-place
    const updatedJSON = JSON.stringify(this.files); // stringify the whole updated object
    const result = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(updatedJSON, "utf8"),
      "text/plain",
      "updated_telebit.txt"
    );
    return result;
  }

  async findWithUploadId(uploadId) {
    await this.find(); // returns { createAt, data: [...] }
    const result = this.files.find((file) => file.uploadId === uploadId);
    if (!result) {
      const error = new Error(
        `cannot find file with this uploadId: ${uploadId}`
      );
      error.statusCode = 404;
      throw error;
    }
    return result;
  }

  async renameFileByUploadId(uploadId, name) {
    const file = await this.findWithUploadId(uploadId);

    const ext = path.extname(file.filename);
    const basename = path.basename(file.filename, ext);

    if (basename === name) {
      const error = new Error("this name is same old name");
      error.statusCode = 409;
      throw error;
    }

    file.filename = name + ext;
    file.updatedAt = Date.now();
    delete file.fileIds;
    await this.find();
    const files = this.files.filter((file) => file.uploadId !== uploadId);
    files.push(file);
    this.files = files;
    const updatedJSON = JSON.stringify(this.files);

    const result = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(updatedJSON, "utf8"),
      "text/plain",
      "updated_telebit.txt"
    );

    return { result, file };
  }

  async deleteFileByUploadId(uploadId) {
    await this.findWithUploadId(uploadId);
    // const response = await this.find();
    const files = this.files.filter((file) => file.uploadId !== uploadId);
    this.files = files;
    const updatedJSON = JSON.stringify(this.files);

    const result = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(updatedJSON, "utf8"),
      "text/plain",
      "updated_telebit.txt"
    );

    return result;
  }

  async readFileSingle(fileId) {
    const chunk = await this.bot.getDocument(fileId);
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk, "binary");
    return buffer;
  }

  async readFile(fileIds) {
    const emitter = new events.EventEmitter();

    process.nextTick(async () => {
      try {
        for (const fileId of fileIds) {
          const chunk = await this.bot.getDocument(fileId);
          const buffer = Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(chunk, "binary"); // fallback
          emitter.emit("data", buffer);
        }
        emitter.emit("end");
      } catch (err) {
        emitter.emit("error", err);
      }
    });

    return emitter;
  }

  writeFileSync(userId, content) {
    const user = users.find((user) => user.userId === userId);

    user["file"] = content;
    fs.writeFileSync(filePath, JSON.stringify(users), {
      encoding: "utf8",
      flag: "w",
    });
  }
}

module.exports = Database;
