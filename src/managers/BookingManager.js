// BookingManager.js — Central booking lifecycle manager. SINGLETON.
// ★ processBooking() is the CFG CORE function (30-50 LOC).
// Single entry, single exit, structured if/else with 5 decision nodes.
// RTOS Concepts: mutex ownership check, fail-safe rollback, timeout cancellation.
const SeatManager = require('./SeatManager.js');
const MutexManager = require('./MutexManager.js');
const PaymentProcessor = require('./PaymentProcessor.js');
const TimeoutWatcher = require('./TimeoutWatcher.js');
const Booking = require('../models/Booking.js');
const Validator = require('../utils/Validator.js');
const Logger = require('../utils/Logger.js');

class BookingManager {
  static #instance = null;
  #bookings; // Map<bookingId, Booking>

  constructor() {
    if (BookingManager.#instance) {
      throw new Error('BookingManager is a singleton. Use BookingManager.getInstance()');
    }
    this.#bookings = new Map();
  }

  static getInstance() {
    if (!BookingManager.#instance) {
      BookingManager.#instance = new BookingManager();
    }
    return BookingManager.#instance;
  }

  /**
   * ★ CORE CFG FUNCTION — 30-50 executable statements ★
   * Single entry point. Single exit (returns {success, ...}).
   * Structured if/else with 5 decision nodes for CFG drawing.
   *
   * Decision nodes:
   *   1. Validator.seatExists throws? → Error exit
   *   2. Validator.amountMatches throws? → Error exit
   *   3. seat.isLockedBy(userId)? → Error exit
   *   4. PaymentProcessor.process throws? → Rollback → Error exit
   *   5. paymentResult.success? → Rollback → Error exit
   *   6. (implicit else) → Success exit
   *
   * @param {number} seatId
   * @param {string} userId
   * @param {number} paymentAmount
   * @returns {{success: boolean, booking?: Booking, error?: string}}
   */
  processBooking(seatId, userId, paymentAmount) {
    // ── ENTRY ──
    const startTime = Logger.start();

    // Step 1: Validate inputs (defensive programming)
    // ── DECISION NODE 1 & 2: validation throws → error exit ──
    try {
      Validator.seatExists(seatId);
      Validator.amountMatches(seatId, paymentAmount);
    } catch (e) {
      Logger.end(startTime, 'processBooking');
      return { success: false, error: e.message };
    }

    // Step 2: Verify user holds the mutex lock for this seat
    const seat = SeatManager.getInstance().getSeat(seatId);
    // ── DECISION NODE 3: ownership check ──
    if (!seat.isLockedBy(userId)) {
      Logger.end(startTime, 'processBooking');
      return { success: false, error: 'Seat is not locked by you' };
    }

    // Step 3: Process payment
    // ── DECISION NODE 4: try-catch for payment errors ──
    let paymentResult;
    try {
      paymentResult = PaymentProcessor.process(userId, paymentAmount);
    } catch (e) {
      // FAIL-SAFE ROLLBACK: unexpected payment exception → revert seat to AVAILABLE
      SeatManager.getInstance().releaseSeat(seatId, userId);
      MutexManager.getInstance().forceRelease(seatId);
      TimeoutWatcher.getInstance().cancel(seatId);
      Logger.end(startTime, 'processBooking');
      return { success: false, error: 'Payment system error — seat released' };
    }

    // ── DECISION NODE 5: payment result check ──
    if (!paymentResult.success) {
      // FAIL-SAFE ROLLBACK: payment declined — revert seat to AVAILABLE
      seat.rollback();
      MutexManager.getInstance().release(seatId, userId);
      TimeoutWatcher.getInstance().cancel(seatId);
      Logger.end(startTime, 'processBooking');
      return { success: false, error: 'Payment failed — seat released' };
    }

    // Step 4: Confirm booking — transition seat to BOOKED
    seat.confirm();

    // Step 5: Create immutable booking record
    const booking = new Booking(seatId, userId, paymentAmount);
    this.#bookings.set(booking.id, booking);

    // Step 6: Release mutex + cancel timeout (booking complete)
    MutexManager.getInstance().release(seatId, userId);
    TimeoutWatcher.getInstance().cancel(seatId);

    // ── EXIT ──
    Logger.end(startTime, 'processBooking');
    return { success: true, booking };
  }

  /**
   * Get all bookings.
   * @returns {Booking[]}
   */
  getAllBookings() {
    return Array.from(this.#bookings.values());
  }

  /**
   * Get a specific booking by ID.
   * @param {string} bookingId
   * @returns {Booking|undefined}
   */
  getBooking(bookingId) {
    return this.#bookings.get(bookingId);
  }

  /**
   * Clear all bookings. Used by admin reset.
   */
  resetAll() {
    const count = this.#bookings.size;
    this.#bookings.clear();
    if (count > 0) console.log(`[BookingManager] Cleared ${count} bookings`);
    return count;
  }
}

module.exports = BookingManager;
