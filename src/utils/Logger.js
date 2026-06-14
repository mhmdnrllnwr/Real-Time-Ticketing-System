// Logger.js — Performance timing utility for soft real-time deadline proof (<250ms)
const { SOFT_DEADLINE_MS } = require('./constants.js');

class Logger {
  /**
   * Start a high-resolution timer.
   * @returns {bigint} hrtime.bigint() timestamp
   */
  static start() {
    return process.hrtime.bigint();
  }

  /**
   * End timer and log elapsed time. Warns if over soft deadline.
   * @param {bigint} startTime — from Logger.start()
   * @param {string} label — operation name (e.g. 'lock', 'processBooking')
   * @returns {number} elapsed milliseconds
   */
  static end(startTime, label) {
    const elapsed = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    if (elapsed > SOFT_DEADLINE_MS) {
      console.warn(`[RT-WARN] ${label}: ${elapsed.toFixed(2)}ms > ${SOFT_DEADLINE_MS}ms deadline`);
    } else {
      console.log(`[RT-OK] ${label}: ${elapsed.toFixed(2)}ms`);
    }
    return elapsed;
  }
}

module.exports = Logger;
