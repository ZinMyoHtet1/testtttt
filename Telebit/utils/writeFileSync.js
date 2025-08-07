const fs = require("fs");
// const path = require("path");

function writeFileSync(userId, content, filePath) {
  // const filePath = path.join(__dirname, "./../db/user.json");
  const users = require(filePath);
  users[userId] = content;
  fs.writeFileSync(filePath, JSON.stringify(users), {
    encoding: "utf8",
    flag: "w",
  });
}

module.exports = writeFileSync;
