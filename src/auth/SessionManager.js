// SessionManager.js — Username ↔ socket.id mapping.
// Tracks online users. No password/DB — focus on real-time booking.
const Validator = require('../utils/Validator.js');

class SessionManager {
  #usernameToSocket; // Map<username, socketId>
  #socketToUsername; // Map<socketId, username>

  constructor() {
    this.#usernameToSocket = new Map();
    this.#socketToUsername = new Map();
  }

  /**
   * Register a new user session.
   * @param {string} username
   * @param {string} socketId
   * @returns {{success: boolean, error?: string}}
   */
  register(username, socketId) {
    try {
      Validator.usernameValid(username);
    } catch (e) {
      return { success: false, error: e.message };
    }

    const trimmed = username.trim();

    if (this.#usernameToSocket.has(trimmed)) {
      return { success: false, error: `Username "${trimmed}" is already taken` };
    }

    // Remove any existing socket mapping (reconnection safety)
    if (this.#socketToUsername.has(socketId)) {
      const oldUsername = this.#socketToUsername.get(socketId);
      this.#usernameToSocket.delete(oldUsername);
    }

    this.#usernameToSocket.set(trimmed, socketId);
    this.#socketToUsername.set(socketId, trimmed);
    console.log(`[Session] ${trimmed} joined (socket: ${socketId}) | Online: ${this.getOnlineCount()}`);
    return { success: true };
  }

  /**
   * Remove a user session on disconnect.
   * @param {string} socketId
   * @returns {string|null} the removed username, or null
   */
  remove(socketId) {
    const username = this.#socketToUsername.get(socketId);
    if (username) {
      this.#socketToUsername.delete(socketId);
      this.#usernameToSocket.delete(username);
      console.log(`[Session] ${username} left | Online: ${this.getOnlineCount()}`);
    }
    return username || null;
  }

  /**
   * Get username for a socket ID.
   * @param {string} socketId
   * @returns {string|undefined}
   */
  getUsername(socketId) {
    return this.#socketToUsername.get(socketId);
  }

  /**
   * Get socket ID for a username.
   * @param {string} username
   * @returns {string|undefined}
   */
  getSocketId(username) {
    return this.#usernameToSocket.get(username);
  }

  /**
   * Check if a username is already in use.
   * @param {string} username
   * @returns {boolean}
   */
  isUsernameTaken(username) {
    return this.#usernameToSocket.has(username.trim());
  }

  /**
   * Get number of online users.
   * @returns {number}
   */
  getOnlineCount() {
    return this.#socketToUsername.size;
  }

  /**
   * Get all online usernames.
   * @returns {string[]}
   */
  getOnlineUsers() {
    return Array.from(this.#socketToUsername.values());
  }
}

module.exports = SessionManager;
