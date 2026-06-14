// TimeoutWatcher.js — Implements RTOS "event flag" pattern.
// When seat is locked, a timer starts. If timer fires before payment,
// seat is force-released. If payment succeeds, timer is cancelled.
// RTOS Mapping: start() = xTimerStart(), cancel() = xTimerStop()
//               expiry callback = xEventGroupSetBits() (event flag)
const { TIMEOUT_MS } = require('../utils/constants.js');

class TimeoutWatcher {
  static #instance = null;
  #timers;      // Map<seatId, timeoutId>
  #onExpiry;    // callback(seatId) — injectable

  constructor() {
    if (TimeoutWatcher.#instance) {
      throw new Error('TimeoutWatcher is a singleton. Use TimeoutWatcher.getInstance()');
    }
    this.#timers = new Map();
    this.#onExpiry = null;
  }

  static getInstance() {
    if (!TimeoutWatcher.#instance) {
      TimeoutWatcher.#instance = new TimeoutWatcher();
    }
    return TimeoutWatcher.#instance;
  }

  /**
   * Set callback invoked when a timer expires.
   * @param {function(number): void} callback — receives seatId
   */
  setOnExpiry(callback) {
    this.#onExpiry = callback;
  }

  /**
   * Start timeout countdown for a seat.
   * Cancels any existing timer for the same seat.
   * @param {number} seatId
   * @param {number} timeoutMs — default 300,000ms (5 min)
   */
  start(seatId, timeoutMs = TIMEOUT_MS) {
    // Cancel existing timer for this seat if any
    if (this.#timers.has(seatId)) {
      clearTimeout(this.#timers.get(seatId));
    }

    const timerId = setTimeout(() => {
      this.#timers.delete(seatId);
      console.log(`[TimeoutWatcher] Timer expired for seat ${seatId}`);
      // EVENT FLAG: notify subscribers
      if (this.#onExpiry) {
        this.#onExpiry(seatId);
      }
    }, timeoutMs);

    this.#timers.set(seatId, timerId);
    console.log(`[TimeoutWatcher] Started ${timeoutMs}ms timer for seat ${seatId}`);
  }

  /**
   * Cancel timeout for a seat (payment completed or manual unlock).
   * @param {number} seatId
   */
  cancel(seatId) {
    if (this.#timers.has(seatId)) {
      clearTimeout(this.#timers.get(seatId));
      this.#timers.delete(seatId);
      console.log(`[TimeoutWatcher] Cancelled timer for seat ${seatId}`);
    }
  }

  /**
   * Check if a timer is active for a seat.
   * @param {number} seatId
   * @returns {boolean}
   */
  hasTimer(seatId) {
    return this.#timers.has(seatId);
  }

  /**
   * Cancel ALL timers (cleanup on shutdown).
   */
  cancelAll() {
    for (const timerId of this.#timers.values()) {
      clearTimeout(timerId);
    }
    this.#timers.clear();
    console.log('[TimeoutWatcher] All timers cancelled');
  }
}

module.exports = TimeoutWatcher;
