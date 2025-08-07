const path = require("path");
const events = require("events");

const Telegram = require("./Telegram.js");
const CustomError = require("./CustomError.js");
const DatabaseModel = require("../models/databaseModel.js");

class File {
  constructor(api, chatId) {
    this.chatId = chatId;
    this.isConnected = false;
    this.files = null;
    this.bot = new Telegram(api);
  }

  async createFileDB() {
    const response = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(JSON.stringify([]), "utf8"),
      "text/plain",
      "telebit.txt"
    );
    return response;
  }

  async getDatabaseWithUserId(userId) {
    if (!userId) throw new CustomError("userId missing", 400);

    const user = await DatabaseModel.findOne({ userId });
    if (!user) throw new CustomError("Invalid userId", 401);

    return user["file"];
  }

  async connect(database) {
    const result = await this.bot.getDocument(database.fileId);

    if (result) {
      this.database = database;
      this.isConnected = true;
    } else {
      throw new CustomError("invalid databaseId", 401);
    }
  }

  async find() {
    if (this.isConnected) {
      let result = await this.bot.getDocument(this.database.fileId);
      result = JSON.parse(result.toString("utf8"));

      if (!result) {
        throw new CustomError("Database not initialized properly.", 400);
      }
      this.files = result;
      return result;
    } else {
      console.log("need to connect database");
      throw new CustomError("need to connect database", 400);
    }
  }

  async create(newData) {
    await this.find(); // returns { createAt, data: [...] }
    this.files.push(newData); // update the array in-place
    return await this.sendUpdate(this.files);
  }

  async findWithUploadId(uploadId) {
    await this.find(); // returns { createAt, data: [...] }
    const result = this.files.find((file) => file.uploadId === uploadId);
    if (!result) {
      throw new CustomError(
        `cannot find file with this uploadId: ${uploadId}`,
        404
      );
    }
    return result;
  }

  async renameFileByUploadId(uploadId, name) {
    const file = await this.findWithUploadId(uploadId);

    const ext = path.extname(file.filename);
    const basename = path.basename(file.filename, ext);

    if (basename === name)
      throw new CustomError("this name is same old name", 409);

    file.filename = name + ext;
    file.updatedAt = Date.now();
    delete file.fileIds;
    await this.find();
    this.files = this.files.filter((file) => file.uploadId !== uploadId);
    this.files.push(file);
    const result = await this.sendUpdate(this.files);

    return { result, file };
  }

  async deleteFileByUploadId(uploadId) {
    await this.findWithUploadId(uploadId);
    const files = this.files.filter((file) => file.uploadId !== uploadId);
    this.files = files;

    return await this.sendUpdate(this.files);
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

  async updateFileDB(userId, content) {
    const user = await DatabaseModel.findOne({ userId });
    if (!user)
      throw new CustomError(`no found user with this userId: ${userId}`, 404);

    const update = { file: content };
    await DatabaseModel.findOneAndUpdate({ userId }, update, {
      new: true,
    });
  }

  async sendUpdate(data) {
    const updatedJSON = JSON.stringify(data);

    const result = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(updatedJSON, "utf8"),
      "text/plain",
      "updated_telebit.txt"
    );
    return result;
  }
}

module.exports = File;
