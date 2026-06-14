// PaymentProcessor.js — Mock payment gateway simulation.
// Controllable failure mode for demonstrating fail-safe rollback path.
// Admin can toggle force-fail via Socket.IO event.
// Wrapped in try-catch for defensive programming.
class PaymentProcessor {
  static #forceFail = false; // false = always succeed, true = always fail

  /**
   * Toggle forced failure mode for presentation/demo purposes.
   * @param {boolean} enabled — true to force all payments to fail
   */
  static setForceFail(enabled) {
    PaymentProcessor.#forceFail = !!enabled;
    console.log(`[Payment] Force fail: ${PaymentProcessor.#forceFail ? 'ON' : 'OFF'}`);
  }

  /**
   * @returns {boolean} current force-fail state
   */
  static isForceFail() {
    return PaymentProcessor.#forceFail;
  }

  /**
   * Process a mock payment.
   * Deterministic — succeeds unless admin has enabled force-fail.
   * Defensive: wrapped in try-catch. Returns structured result.
   * @param {string} userId
   * @param {number} amount
   * @returns {{success: boolean, transactionId?: string, error?: string}}
   */
  static process(userId, amount) {
    try {
      // Simulate payment gateway latency (10-50ms)
      const delay = Math.floor(Math.random() * 41) + 10;
      const start = Date.now();
      while (Date.now() - start < delay) { /* busy-wait simulation */ }

      const success = !PaymentProcessor.#forceFail;

      if (success) {
        const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        console.log(`[Payment] SUCCESS: ${userId} paid RM ${amount} | ${transactionId}`);
        return { success: true, transactionId };
      } else {
        console.log(`[Payment] FORCE-DECLINED: ${userId} payment of RM ${amount} declined (force-fail active)`);
        return { success: false, error: 'Payment declined — rollback demo' };
      }
    } catch (e) {
      // Unexpected payment system error
      console.error(`[Payment] ERROR: ${e.message}`);
      return { success: false, error: `Payment system error: ${e.message}` };
    }
  }
}

module.exports = PaymentProcessor;
