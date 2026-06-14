// server.js — Entry point for Real-Time Cinema Ticketing System.
// Bootstraps Express, Socket.IO, all singletons, and wires event handlers.
// Supports Redis adapter for multi-instance scaling ( Cloud Run ).
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Initialize domain singletons
const SeatManager = require('./src/managers/SeatManager.js');
const BookingManager = require('./src/managers/BookingManager.js');
const MutexManager = require('./src/managers/MutexManager.js');
const TimeoutWatcher = require('./src/managers/TimeoutWatcher.js');
const PaymentProcessor = require('./src/managers/PaymentProcessor.js');

// Transport
const { attachHandlers } = require('./src/transport/socketHandler.js');

const { SEAT_COUNT, TIMEOUT_MS } = require('./src/utils/constants.js');

// ── Initialize all singletons at startup ──
const seatManager = SeatManager.getInstance();
seatManager.initialize(SEAT_COUNT);

const mutexManager = MutexManager.getInstance();
const bookingManager = BookingManager.getInstance();
const timeoutWatcher = TimeoutWatcher.getInstance();

// Payment processor: deterministic (only fails when admin enables force-fail)
PaymentProcessor.setForceFail(false);

console.log('═══════════════════════════════════════');
console.log('  Real-Time Cinema Ticketing System');
console.log('═══════════════════════════════════════');
console.log(`  Seats:       ${SEAT_COUNT}`);
console.log(`  Timeout:     ${TIMEOUT_MS / 1000}s (${TIMEOUT_MS / 60000} min)`);
console.log(`  Payment:     Always succeeds (force-fail: OFF)`);
console.log(`  Deadline:    <250ms per operation`);
console.log('═══════════════════════════════════════');

// ── Express + Socket.IO setup ──
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ── Start server ──
const PORT = process.env.PORT || 3000;

async function start() {
  // ── Redis adapter (optional — only when REDIS_URL is set) ──
  if (process.env.REDIS_URL) {
    try {
      const Redis = require('ioredis');

      const pubClient = new Redis(process.env.REDIS_URL);
      const subClient = pubClient.duplicate();

      // Wait for connection
      await Promise.all([
        new Promise((resolve, reject) => {
          pubClient.on('ready', resolve);
          pubClient.on('error', reject);
        }),
        new Promise((resolve, reject) => {
          subClient.on('ready', resolve);
          subClient.on('error', reject);
        })
      ]);

      const { createAdapter } = require('@socket.io/redis-adapter');
      io.adapter(createAdapter(pubClient, subClient));
      console.log('  Redis:       Connected (multi-instance mode)');
      console.log(`  REDIS_URL:   ${process.env.REDIS_URL.replace(/\/\/.*@/, '//***@')}`);
    } catch (err) {
      console.warn('  Redis:       Failed to connect — falling back to single-instance mode');
      console.warn(`  Reason:      ${err.message}`);
    }
  } else {
    console.log('  Mode:        Single-instance (no REDIS_URL)');
  }

  // Wire real-time event handlers
  attachHandlers(io);

  server.listen(PORT, () => {
    console.log(`\n  Server running on http://localhost:${PORT}`);
    console.log('  Open multiple browser tabs to test concurrency\n');
  });

  // ── Graceful shutdown ──
  const shutdown = async () => {
    console.log('\n[Shutdown] Cleaning up...');
    timeoutWatcher.cancelAll();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
