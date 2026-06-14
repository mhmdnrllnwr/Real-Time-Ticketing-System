// Seat.js — Domain model for a single cinema seat.
// Enforces state machine: AVAILABLE → LOCKED → BOOKED
// All fields private (information hiding). Access via get/set.
// RTOS Concept: Each lock() is a mutex-protected state transition.
const { SeatStatus } = require('../utils/constants.js');

class Seat {
  #id;
  #status;
  #lockedBy;
  #lockedAt;
  #bookedBy;

  /**
   * @param {number} id — seat number (1–32)
   */
  constructor(id) {
    this.#id = id;
    this.#status = SeatStatus.AVAILABLE;
    this.#lockedBy = null;
    this.#lockedAt = null;
    this.#bookedBy = null;
  }

  // ── Public Accessors (Data Coupling by Value) ──

  get id() {
    return this.#id;
  }

  get status() {
    return this.#status;
  }

  get lockedBy() {
    return this.#lockedBy;
  }

  get lockedAt() {
    return this.#lockedAt;
  }

  get bookedBy() {
    return this.#bookedBy;
  }

  // ── State Transitions (single entry, single exit) ──

  /**
   * Lock seat for a user. Only valid from AVAILABLE state.
   * Mutex-protected state transition.
   * @param {string} userId
   * @throws {Error} if seat is not AVAILABLE
   */
  lock(userId) {
    if (this.#status !== SeatStatus.AVAILABLE) {
      throw new Error(`Cannot lock seat ${this.#id}: current status is ${this.#status}`);
    }
    this.#status = SeatStatus.LOCKED;
    this.#lockedBy = userId;
    this.#lockedAt = Date.now();
  }

  /**
   * Release lock — return to AVAILABLE. Only valid from LOCKED state.
   * @throws {Error} if seat is not LOCKED
   */
  unlock() {
    if (this.#status !== SeatStatus.LOCKED) {
      throw new Error(`Cannot unlock seat ${this.#id}: current status is ${this.#status}`);
    }
    this.#status = SeatStatus.AVAILABLE;
    this.#lockedBy = null;
    this.#lockedAt = null;
    this.#bookedBy = null;
  }

  /**
   * Confirm booking — transition to BOOKED. Only valid from LOCKED state.
   * @throws {Error} if seat is not LOCKED
   */
  confirm() {
    if (this.#status !== SeatStatus.LOCKED) {
      throw new Error(`Cannot confirm seat ${this.#id}: current status is ${this.#status}`);
    }
    this.#status = SeatStatus.BOOKED;
    this.#bookedBy = this.#lockedBy;
    this.#lockedBy = null;
    this.#lockedAt = null;
  }

  /**
   * Rollback to AVAILABLE from any state. Used for fail-safe recovery.
   * Idempotent — does not throw.
   */
  rollback() {
    this.#status = SeatStatus.AVAILABLE;
    this.#lockedBy = null;
    this.#lockedAt = null;
    this.#bookedBy = null;
  }

  // ── Status Checks ──

  /**
   * @returns {boolean}
   */
  isAvailable() {
    return this.#status === SeatStatus.AVAILABLE;
  }

  /**
   * Check if this seat is currently locked by a specific user.
   * @param {string} userId
   * @returns {boolean}
   */
  isLockedBy(userId) {
    return this.#status === SeatStatus.LOCKED && this.#lockedBy === userId;
  }

  /**
   * Check if this seat is currently locked by anyone.
   * @returns {boolean}
   */
  isLocked() {
    return this.#status === SeatStatus.LOCKED;
  }
}

module.exports = Seat;
