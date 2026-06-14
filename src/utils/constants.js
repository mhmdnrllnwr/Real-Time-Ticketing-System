// constants.js — Shared constants for the ticketing system
// Frozen objects to emulate RTOS configuration

const SeatStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  LOCKED: 'LOCKED',
  BOOKED: 'BOOKED'
});

const TICKET_PRICE = 12.00;         // RM
const SEAT_COUNT = 32;              // 8 columns × 4 rows
const TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes (300,000ms)
const TIMEOUT_MS_TEST = 30 * 1000;  // 30 seconds for testing
const SOFT_DEADLINE_MS = 250;       // Soft real-time deadline

module.exports = { SeatStatus, TICKET_PRICE, SEAT_COUNT, TIMEOUT_MS, TIMEOUT_MS_TEST, SOFT_DEADLINE_MS };
