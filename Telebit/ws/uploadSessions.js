// A shared map to track WebSocket connections per upload session
const uploadSessions = new Map();

module.exports = { uploadSessions };
