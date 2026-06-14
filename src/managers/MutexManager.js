// MutexManager.js — Simulates RTOS mutex.
// Tracks which resources (seats) are locked by which owner.
// Uses JavaScript Map as lock table. Node.js single-thread guarantees
// atomic-like Map.get/Map.set within a synchronous tick.
// RTOS Mapping: acquire() = xSemaphoreTake() / pthread_mutex_lock()
//               release() = xSemaphoreGive() / pthread_mutex_unlock()
//               forceRelease() = deadlock breaker / timeout-triggered release
class MutexManager {
  static #instance = null;

  #locks; // Map<resourceId, {owner: string, timestamp: number}>

  constructor() {
    if (MutexManager.#instance) {
      throw new Error('MutexManager is a singleton. Use MutexManager.getInstance()');
    }
    this.#locks = new Map();
  }

  static getInstance() {
    if (!MutexManager.#instance) {
      MutexManager.#instance = new MutexManager();
    }
    return MutexManager.#instance;
  }

  /**
   * Acquire mutex lock on a resource (test-and-set).
   * Returns {success: false} if already locked — denial, no wait.
   * Maps to: xSemaphoreTake() / pthread_mutex_lock()
   * @param {number} resourceId — seat ID
   * @param {string} ownerId — user ID
   * @returns {{success: boolean, reason?: string}}
   */
  acquire(resourceId, ownerId) {
    if (this.#locks.has(resourceId)) {
      return { success: false, reason: `Resource ${resourceId} is locked` };
    }
    this.#locks.set(resourceId, {
      owner: ownerId,
      timestamp: Date.now()
    });
    return { success: true };
  }

  /**
   * Release mutex lock. Only the lock owner can release.
   * Maps to: xSemaphoreGive() / pthread_mutex_unlock()
   * @param {number} resourceId
   * @param {string} ownerId
   * @returns {boolean} true if released, false if not owner or not locked
   */
  release(resourceId, ownerId) {
    const lock = this.#locks.get(resourceId);
    if (!lock) {
      return false;
    }
    if (lock.owner !== ownerId) {
      return false; // Owner check — prevents cross-user release
    }
    this.#locks.delete(resourceId);
    return true;
  }

  /**
   * Force-release mutex — bypasses owner check.
   * Used by TimeoutWatcher when lock timer expires (deadlock breaker).
   * @param {number} resourceId
   */
  forceRelease(resourceId) {
    this.#locks.delete(resourceId);
  }

  /**
   * Check if resource has an active lock.
   * @param {number} resourceId
   * @returns {boolean}
   */
  isLocked(resourceId) {
    return this.#locks.has(resourceId);
  }

  /**
   * Get the owner of a lock on a resource.
   * @param {number} resourceId
   * @returns {string|null}
   */
  getLockOwner(resourceId) {
    const lock = this.#locks.get(resourceId);
    return lock ? lock.owner : null;
  }

  /**
   * Get all locked resource IDs for a specific owner.
   * Used for disconnect cleanup.
   * @param {string} ownerId
   * @returns {number[]}
   */
  getLocksByOwner(ownerId) {
    const results = [];
    for (const [resourceId, lock] of this.#locks) {
      if (lock.owner === ownerId) {
        results.push(resourceId);
      }
    }
    return results;
  }
}

module.exports = MutexManager;
