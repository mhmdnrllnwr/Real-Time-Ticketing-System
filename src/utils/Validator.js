// Validator.js — Defensive programming: validate all inputs before processing
const { TICKET_PRICE, SEAT_COUNT } = require('./constants.js');
const SeatManager = require('../managers/SeatManager.js');

class Validator {
  /**
   * Semantic check: seat ID is valid and seat object exists.
   * @param {number} seatId
   * @throws {Error} if seat does not exist
   */
  static seatExists(seatId) {
    if (!Number.isInteger(seatId) || seatId < 1 || seatId > SEAT_COUNT) {
      throw new Error(`Seat ${seatId} does not exist (valid range: 1-${SEAT_COUNT})`);
    }
    const seat = SeatManager.getInstance().getSeat(seatId);
    if (!seat) {
      throw new Error(`Seat ${seatId} not found in registry`);
    }
  }

  /**
   * Algorithmic check: payment amount must equal ticket price.
   * Prevents number overflow and incorrect payment amounts.
   * @param {number} seatId — unused but kept for consistent interface
   * @param {number} amount
   * @throws {Error} if amount does not match ticket price
   */
  static amountMatches(seatId, amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error(`Invalid payment amount: ${amount}`);
    }
    if (amount !== TICKET_PRICE) {
      throw new Error(`Amount RM ${amount} does not match ticket price RM ${TICKET_PRICE}`);
    }
  }

  /**
   * Validate username format.
   * @param {string} username
   * @throws {Error} if username is invalid
   */
  static usernameValid(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('Username is required');
    }
    const trimmed = username.trim();
    if (trimmed.length === 0 || trimmed.length > 20) {
      throw new Error('Username must be 1-20 characters');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }
  }
}

module.exports = Validator;
