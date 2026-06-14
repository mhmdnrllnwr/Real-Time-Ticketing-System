// Booking.js — Immutable record of a completed booking.
const { TICKET_PRICE } = require('../utils/constants.js');

class Booking {
  #id;
  #seatId;
  #userId;
  #amount;
  #bookedAt;
  #status;

  /**
   * @param {number} seatId
   * @param {string} userId
   * @param {number} amount — should equal TICKET_PRICE
   */
  constructor(seatId, userId, amount) {
    this.#id = `BK-${Date.now()}-${seatId}-${Math.random().toString(36).slice(2, 6)}`;
    this.#seatId = seatId;
    this.#userId = userId;
    this.#amount = amount;
    this.#bookedAt = Date.now();
    this.#status = 'CONFIRMED';
  }

  // ── Accessors ──

  get id() { return this.#id; }
  get seatId() { return this.#seatId; }
  get userId() { return this.#userId; }
  get amount() { return this.#amount; }
  get bookedAt() { return this.#bookedAt; }
  get status() { return this.#status; }

  /**
   * Serialize to plain object for JSON transmission over Socket.IO.
   * @returns {object}
   */
  toJSON() {
    return {
      id: this.#id,
      seatId: this.#seatId,
      userId: this.#userId,
      amount: this.#amount,
      bookedAt: new Date(this.#bookedAt).toISOString(),
      status: this.#status
    };
  }
}

module.exports = Booking;
