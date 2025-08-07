const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET;

class JWT {
  constructor() {}

  sign(payload, options = {}) {
    const opts = { algorithm: "HS256", ...options };
    return jwt.sign(payload, jwtSecret, opts);
  }

  verify(token) {
    if (!token) {
      const error = new Error("No token found");
      error.statusCode = 400;
      throw error;
    }
    return jwt.verify(token, jwtSecret);
  }
}

module.exports = JWT;
