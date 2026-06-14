// server.js — Entry point for Real-Time Cinema Ticketing System.
// Bootstraps Express, Socket.IO, all singletons, and wires event handlers.
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

// Wire real-time event handlers
attachHandlers(io);

// ── Start server ──
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Server running on http://localhost:${PORT}`);
  console.log('  Open multiple browser tabs to test concurrency\n');
});

// ── Graceful shutdown ──
process.on('SIGINT', () => {
  console.log('\n[Shutdown] Cleaning up...');
  timeoutWatcher.cancelAll();
  server.close();
  process.exit(0);
});
