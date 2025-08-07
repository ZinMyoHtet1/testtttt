const Telegram = require("./Telegram.js");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const filePath = path.join(__dirname, "./../db/user.json");
const users = require(filePath);

async function generateUUID() {
  try {
    const userId = crypto.randomUUID();
    return userId;
  } catch (error) {
    throw error;
  }
}

class Directory {
  constructor(api, chatId) {
    this.chatId = chatId;
    this.directories = null;
    this.rootDirectory = null;
    this.bot = new Telegram(api);
  }

  async connect(directory) {
    const result = await this.bot.getDocument(directory.fileId);

    if (result) {
      this.directory = directory;
    } else {
      throw new Error("invalid databaseId");
    }
  }

  async createDirectoryDB() {
    const newDB = [
      {
        id: "root",
        files: [],
        childDirIds: [],
        createdAt: Date.now(),
      },
    ];

    const newDbJSON = JSON.stringify(newDB);
    const response = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(newDbJSON, "utf8"),
      "text/plain",
      "directory.txt"
    );
    delete response.size;
    return response;
  }

  async find() {
    if (!this.directory) {
      const error = new Error("no connection to directory db");
      error.statusCode = 401;
      throw error;
    }
    let result = await this.bot.getDocument(this.directory.fileId);
    result = JSON.parse(result.toString("utf8"));
    this.directories = result;
    this.rootDirectory = result.find((dir) => (dir.id = "root"));
    return result;
  }

  async findById(id) {
    await this.find();
    const result = this.directories.find((dir) => dir.id === id);
    if (!result) {
      const error = new Error(`no found directory with this dirId: ${id}`);
      error.statusCode = 404;
      throw error;
    }
    return result;
  }

  async create(name, parentId = "root") {
    let newDirectory;
    if (parentId === "root") {
      await this.find();
      const id = await generateUUID();

      newDirectory = {
        id,
        name,
        files: [],
        childDirIds: [],
        parentDirIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.directories.push(newDirectory);
      this.rootDirectory.childDirIds.push(id);
    } else {
      const rootDirectory = await this.findById(parentId);
      const childDirIdsFromRoot = rootDirectory.childDirIds;
      const parentDirIdsFromRoot = rootDirectory.parentDirIds;
      const childDirectoriesFromRoot = this.directories.filter((dir) =>
        childDirIdsFromRoot.includes(dir.id)
      );
      const childDirnamesUnderRoot = childDirectoriesFromRoot.map(
        (dir) => dir.name
      );

      if (childDirnamesUnderRoot.includes(name)) {
        const error = new Error(`this folder name existed`);
        error.statusCode = 409;
        throw error;
      }

      const parentDirIds = [...parentDirIdsFromRoot, parentId];
      const id = await generateUUID();

      newDirectory = {
        id,
        name,
        files: [],
        childDirIds: [],
        parentDirIds: parentDirIds,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      childDirIdsFromRoot.push(id);
      this.directories.push(newDirectory);
    }

    const result = await this.sendUpdate(this.directories);
    return { result, directory: newDirectory };
  }

  getDirectoryDBWithUserId(userId) {
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

    return user["directory"];
  }

  async addFileToDirectory(directoryId, uploadId) {
    const directory = await this.findById(directoryId);
    directory.files.push(uploadId);

    return await this.sendUpdate(this.directories);
  }

  rename() {}

  delete() {}
  // const path = require("path");

  writeFileSync(userId, content) {
    const user = users.find((user) => user.userId === userId);

    user["directory"] = content;
    fs.writeFileSync(filePath, JSON.stringify(users), {
      encoding: "utf8",
      flag: "w",
    });
  }

  async sendUpdate(data) {
    const updatedJSON = JSON.stringify(data); // stringify the whole updated object
    const result = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(updatedJSON, "utf8"),
      "text/plain",
      "updated_directory.txt"
    );
    return result;
  }
}

module.exports = Directory;
