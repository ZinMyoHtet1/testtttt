const crypto = require("crypto");

const Telegram = require("./Telegram.js");
const CustomError = require("./CustomError.js");

const DatabaseModel = require("./../models/databaseModel.js");

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
      throw new CustomError("invalid databaseId", 401);
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

    const response = await this.bot.sendDocument(
      this.chatId,
      Buffer.from(JSON.stringify(newDB), "utf8"),
      "text/plain",
      "directory.txt"
    );
    delete response.size;
    return response;
  }

  async find() {
    if (!this.directory)
      throw new CustomError("no connection to directory db", 400);
    let result = await this.bot.getDocument(this.directory.fileId);
    result = JSON.parse(result.toString("utf8"));
    this.directories = result;
    this.rootDirectory = result.find((dir) => (dir.id = "root"));
    return result;
  }

  async findById(id) {
    await this.find();
    const result = this.directories.find((dir) => dir.id === id);
    if (!result)
      throw new CustomError(`no found directory with this dirId: ${id}`, 404);

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

      if (childDirnamesUnderRoot.includes(name))
        throw new CustomError(`this folder name existed`, 409);

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

  async getDatabaseWithUserId(userId) {
    if (!userId) throw new CustomError("Unauthorized", 401);
    const user = await DatabaseModel.findOne({ userId });
    if (!user) throw new CustomError("Invalid userId", 401);

    return user["directory"];
  }

  async addFileToDirectory(directoryId, uploadId) {
    const directory = await this.findById(directoryId);
    directory.files.push(uploadId);

    return await this.sendUpdate(this.directories);
  }

  async removeFileFromDirectory(directoryId, uploadId) {
    const directory = await this.findById(directoryId);
    const indexToRemove = directory.files.findIndex(
      (element) => element === uploadId
    );
    directory.files.splice(indexToRemove, 1);

    return await this.sendUpdate(this.directories);
  }

  async renameDirectoryById(directoryId, name) {
    const directory = await this.findById(directoryId);
    const oldName = directory.name;

    if (oldName === name)
      throw new CustomError("this name same to the old name", 409);

    //removed target directory
    this.directories = this.directories.filter(
      (dir) => dir.id !== directory.id
    );
    //updated target directory
    directory.name = name;
    directory.updatedAt = Date.now();
    this.directories.push(directory);

    //send to telegram
    const result = await this.sendUpdate(this.directories);
    return { result, directory };
  }

  async deleteDirectoryById(directoryId) {
    await this.findById(directoryId);
    this.directories = this.directories.filter((dir) => dir.id !== directoryId);

    return await this.sendUpdate(this.directories);
  }

  async updateDirectoryDB(userId, content) {
    const user = await DatabaseModel.findOne({ userId });
    if (!user)
      throw new CustomError(`no found user with this userId: ${userId}`, 404);

    const update = { directory: content };
    await DatabaseModel.findOneAndUpdate({ userId }, update, {
      new: true,
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
