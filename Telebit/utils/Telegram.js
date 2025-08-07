const TelegramBot = require("node-telegram-bot-api");
const https = require("https");

class Telegram {
  constructor(token) {
    this.token = token;
    this.bot = new TelegramBot(token, { polling: true });
  }

  async sendMessage(messageChatId, message) {
    const response = await this.bot.sendMessage(messageChatId, message);
    const result = {
      messageId: response.message_id,
      chatId: response.chat.id,
      text: response.text,
      date: response.date,
    };
    return result;
  }

  async getMessage(chatId, messageId) {
    const forwarded = await this.bot.forwardMessage(chatId, chatId, messageId);
    const result = {
      data: forwarded.text,
      createdAt: forwarded.forward_origin.date,
    };

    return result;
  }

  async editMessage(newText, chatId, messageId) {
    const updatedMessage = await this.bot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
    });
    const result = {
      data: updatedMessage.text,
      updatedAt: updatedMessage.edit_date,
      createdAt: updatedMessage.date,
    };
    return result;
  }

  async deleteMessage(chatId, messageId) {
    await this.bot.deleteMessage(chatId, messageId);
    console.log("deleted message");
  }

  async getDocument(fileId) {
    return new Promise(async (resolve, reject) => {
      const file = await this.bot.getFile(fileId);
      const filePath = file.file_path;

      const url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
      let currentBuffer = Buffer.alloc(0);
      https
        .get(url, (resp) => {
          resp.on(
            "data",
            (chunk) => (currentBuffer = Buffer.concat([currentBuffer, chunk]))
          );
          resp.on("end", () => resolve(currentBuffer));
        })
        .on("error", (err) => reject(err));
    });
  }

  async sendDocument(
    chatId,
    fileContent,
    contentType = "text/plain",
    fileName = "file.txt",
    caption = ""
  ) {
    const result = await this.bot.sendDocument(
      +chatId,
      fileContent,
      {
        caption,
      },
      {
        filename: fileName,
        contentType: contentType,
      }
    );
    let file;
    if (result.document) {
      file = result.document;
    }
    if (result.video) {
      file = result.video;
    }
    if (result.photo) {
      file = result.photo.at(-1);
    }
    return {
      messageId: result.message_id,
      fileId: file.file_id,
      size: file.file_size,
      date: result.date,
    };
  }
}

module.exports = Telegram;
