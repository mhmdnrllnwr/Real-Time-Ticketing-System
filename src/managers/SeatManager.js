// SeatManager.js — Factory + registry for Seat objects.
// Delegates mutex operations to MutexManager.
// Coordinates the mutex with the domain model for atomic lock operations.
// RTOS Concept: Orchestrator — ensures atomicity of mutex + state transition.
const Seat = require('../models/Seat.js');
const MutexManager = require('./MutexManager.js');
const { SEAT_COUNT, SeatStatus } = require('../utils/constants.js');

class SeatManager {
  static #instance = null;
  #seats; // Map<number, Seat>

  constructor() {
    if (SeatManager.#instance) {
      throw new Error('SeatManager is a singleton. Use SeatManager.getInstance()');
    }
    this.#seats = new Map();
  }

  static getInstance() {
    if (!SeatManager.#instance) {
      SeatManager.#instance = new SeatManager();
    }
    return SeatManager.#instance;
  }

  /**
   * Create all seats. Called once at server startup.
   * @param {number} totalSeats — defaults to SEAT_COUNT (32)
   */
  initialize(totalSeats = SEAT_COUNT) {
    this.#seats.clear();
    for (let i = 1; i <= totalSeats; i++) {
      this.#seats.set(i, new Seat(i));
    }
    console.log(`[SeatManager] Initialized ${totalSeats} seats`);
  }

  /**
   * Get a Seat by ID.
   * @param {number} id
   * @returns {Seat|undefined}
   */
  getSeat(id) {
    return this.#seats.get(id);
  }

  /**
   * Get all seats (for broadcasting initial state to clients).
   * @returns {Seat[]}
   */
  getAllSeats() {
    return Array.from(this.#seats.values());
  }

  /**
   * Get separate lists of locked and booked seat IDs (for 'init' event).
   * Client needs to know which seats are locked vs booked to apply correct CSS.
   * @returns {{locked: number[], booked: number[]}}
   */
  getUnavailableSeatIds() {
    const locked = [];
    const booked = [];
    for (const seat of this.#seats.values()) {
      if (seat.status === SeatStatus.LOCKED) {
        locked.push(seat.id);
      } else if (seat.status === SeatStatus.BOOKED) {
        booked.push(seat.id);
      }
    }
    return { locked, booked };
  }

  /**
   * Lock a seat for a user. Atomic: MutexManager test-and-set + Seat state transition.
   * @param {number} seatId
   * @param {string} userId
   * @returns {{success: boolean, error?: string}}
   */
  lockSeat(seatId, userId) {
    const seat = this.getSeat(seatId);
    if (!seat) {
      return { success: false, error: `Seat ${seatId} does not exist` };
    }

    // Step 1: Try to acquire mutex (test-and-set)
    const acquired = MutexManager.getInstance().acquire(seatId, userId);
    if (!acquired.success) {
      return { success: false, error: acquired.reason };
    }

    // Step 2: Transition seat state
    try {
      seat.lock(userId);
      return { success: true };
    } catch (e) {
      // Seat state transition failed — release mutex (atomic rollback)
      MutexManager.getInstance().release(seatId, userId);
      return { success: false, error: e.message };
    }
  }

  /**
   * Release a locked seat and its mutex.
   * @param {number} seatId
   * @param {string} userId
   * @returns {{success: boolean, error?: string}}
   */
  releaseSeat(seatId, userId) {
    const seat = this.getSeat(seatId);
    if (!seat) {
      return { success: false, error: `Seat ${seatId} does not exist` };
    }

    // Verify ownership
    if (!seat.isLockedBy(userId)) {
      return { success: false, error: 'Seat is not locked by you' };
    }

    // Step 1: Transition seat state
    try {
      seat.unlock();
    } catch (e) {
      return { success: false, error: e.message };
    }

    // Step 2: Release mutex
    MutexManager.getInstance().release(seatId, userId);
    return { success: true };
  }

  /**
   * Force-release a seat (used by timeout).
   * @param {number} seatId
   */
  forceRelease(seatId) {
    const seat = this.getSeat(seatId);
    if (seat && seat.isLocked()) {
      seat.rollback();
    }
    MutexManager.getInstance().forceRelease(seatId);
  }

  /**
   * Get all seats currently locked.
   * @returns {Seat[]}
   */
  getLockedSeats() {
    return Array.from(this.#seats.values()).filter(s => s.isLocked());
  }

  /**
   * Reset ALL seats to AVAILABLE. Clears all locks and bookings.
   * Used by admin panel. Notifies all clients via callback.
   * @returns {number} count of seats reset
   */
  resetAll() {
    let count = 0;
    for (const seat of this.#seats.values()) {
      if (seat.status !== SeatStatus.AVAILABLE) {
        seat.rollback();
        count++;
      }
    }
    // Clear all mutex locks
    const mutexManager = MutexManager.getInstance();
    for (let i = 1; i <= this.#seats.size; i++) {
      mutexManager.forceRelease(i);
    }
    console.log(`[SeatManager] Reset ${count} seats to AVAILABLE`);
    return count;
  }

  /**
   * Get detailed seat info for admin panel.
   * @returns {object[]}
   */
  getSeatDetails() {
    return Array.from(this.#seats.values()).map(s => ({
      id: s.id,
      status: s.status,
      lockedBy: s.lockedBy,
      lockedAt: s.lockedAt ? new Date(s.lockedAt).toISOString() : null,
      bookedBy: s.bookedBy
    }));
  }
}

module.exports = SeatManager;
