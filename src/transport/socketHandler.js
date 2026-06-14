// socketHandler.js — Socket.IO event routing.
// Thin transport layer — no business logic. Delegates everything to managers.
const SessionManager = require('../auth/SessionManager.js');
const SeatManager = require('../managers/SeatManager.js');
const BookingManager = require('../managers/BookingManager.js');
const PaymentProcessor = require('../managers/PaymentProcessor.js');
const TimeoutWatcher = require('../managers/TimeoutWatcher.js');
const Logger = require('../utils/Logger.js');
const { TICKET_PRICE, TIMEOUT_MS, SEAT_COUNT } = require('../utils/constants.js');

const ADMIN_PASSWORD = 'admin123';

/**
 * Attach all socket event handlers to a Socket.IO server instance.
 * @param {import('socket.io').Server} io
 */
function attachHandlers(io) {
  const sessionManager = new SessionManager();
  const seatManager = SeatManager.getInstance();
  const bookingManager = BookingManager.getInstance();
  const timeoutWatcher = TimeoutWatcher.getInstance();

  // Wire timeout expiry callback to emit events (EVENT FLAG pattern)
  timeoutWatcher.setOnExpiry((seatId) => {
    seatManager.forceRelease(seatId);
    io.emit('free', { seatId });
    console.log(`[Timeout] Seat ${seatId} auto-released — timer expired`);
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // ── LOGIN ──
    socket.on('login', (data) => {
      const startTime = Logger.start();
      const username = data && data.username ? data.username : '';

      const result = sessionManager.register(username, socket.id);

      if (!result.success) {
        socket.emit('err', result.error);
        Logger.end(startTime, 'login');
        return;
      }

      // Associate username with this socket for all future events
      socket.data.username = username.trim();

      // Send initial state to the new user
      const unavailableIds = seatManager.getUnavailableSeatIds();
      socket.emit('init', {
        seats: unavailableIds,
        username: socket.data.username,
        onlineCount: sessionManager.getOnlineCount()
      });

      // Broadcast join to all other users
      socket.broadcast.emit('user-joined', {
        username: socket.data.username,
        onlineCount: sessionManager.getOnlineCount()
      });

      Logger.end(startTime, 'login');
      console.log(`[Socket] ${socket.data.username} logged in`);
    });

    // ── LOCK SEAT ──
    socket.on('lock', (data) => {
      const startTime = Logger.start();
      const seatId = data && data.seatId ? data.seatId : (typeof data === 'number' ? data : null);

      if (!seatId) {
        socket.emit('err', 'Invalid seat ID');
        Logger.end(startTime, 'lock');
        return;
      }

      if (!socket.data.username) {
        socket.emit('err', 'Please login first');
        Logger.end(startTime, 'lock');
        return;
      }

      const userId = socket.data.username;

      // ── RELEASE-BEFORE-ACQUIRE (deadlock prevention) ──
      // User can only hold one seat lock at a time.
      // Release any existing lock before acquiring a new one.
      const lockedSeats = seatManager.getLockedSeats();
      for (const lockedSeat of lockedSeats) {
        if (lockedSeat.lockedBy === userId) {
          seatManager.releaseSeat(lockedSeat.id, userId);
          TimeoutWatcher.getInstance().cancel(lockedSeat.id);
          io.emit('free', { seatId: lockedSeat.id });
        }
      }

      // Acquire new lock (MUTEX TEST-AND-SET)
      const result = seatManager.lockSeat(seatId, userId);

      if (!result.success) {
        socket.emit('err', result.error);
        Logger.end(startTime, 'lock');
        return;
      }

      // Start 5-minute timeout timer
      timeoutWatcher.start(seatId, TIMEOUT_MS);

      // Notify this user
      socket.emit('ok', { seatId });

      // Notify all other users
      socket.broadcast.emit('locked', {
        seatId,
        by: userId
      });

      Logger.end(startTime, 'lock');
    });

    // ── PAY ──
    socket.on('pay', (data) => {
      const startTime = Logger.start();
      const seatId = data && data.seatId ? data.seatId : null;

      if (!seatId) {
        socket.emit('err', 'Invalid seat ID');
        Logger.end(startTime, 'pay');
        return;
      }

      if (!socket.data.username) {
        socket.emit('err', 'Please login first');
        Logger.end(startTime, 'pay');
        return;
      }

      const result = bookingManager.processBooking(
        seatId,
        socket.data.username,
        TICKET_PRICE
      );

      if (!result.success) {
        // FAIL-SAFE: if booking failed, emit free to all for this seat
        socket.emit('err', result.error);
        io.emit('free', { seatId });
        Logger.end(startTime, 'pay');
        return;
      }

      // Success: notify ALL clients
      io.emit('confirmed', {
        seatId,
        booking: result.booking.toJSON()
      });

      Logger.end(startTime, 'pay');
    });

    // ── UNLOCK (manual release) ──
    socket.on('unlock', (data) => {
      const startTime = Logger.start();
      const seatId = data && data.seatId ? data.seatId : (typeof data === 'number' ? data : null);

      if (!seatId) {
        socket.emit('err', 'Invalid seat ID');
        Logger.end(startTime, 'unlock');
        return;
      }

      if (!socket.data.username) {
        socket.emit('err', 'Please login first');
        Logger.end(startTime, 'unlock');
        return;
      }

      const result = seatManager.releaseSeat(seatId, socket.data.username);

      if (!result.success) {
        socket.emit('err', result.error);
        Logger.end(startTime, 'unlock');
        return;
      }

      timeoutWatcher.cancel(seatId);
      io.emit('free', { seatId });

      Logger.end(startTime, 'unlock');
    });

    // ── DISCONNECT ──
    socket.on('disconnect', () => {
      const username = sessionManager.remove(socket.id);

      if (username) {
        // Release all locks held by this user (cleanup)
        const lockedSeats = seatManager.getLockedSeats();
        for (const seat of lockedSeats) {
          if (seat.lockedBy === username) {
            seatManager.releaseSeat(seat.id, username);
            timeoutWatcher.cancel(seat.id);
            io.emit('free', { seatId: seat.id });
          }
        }

        io.emit('user-left', {
          username,
          onlineCount: sessionManager.getOnlineCount()
        });

        console.log(`[Socket] ${username} disconnected — locks released`);
      }

      // If admin disconnects
      if (socket.data.isAdmin) {
        socket.data.isAdmin = false;
      }
    });

    // ── ADMIN LOGIN ──
    socket.on('admin-login', (data) => {
      const password = data && data.password ? data.password : '';

      if (password !== ADMIN_PASSWORD) {
        socket.emit('admin-err', 'Invalid admin password');
        return;
      }

      socket.data.isAdmin = true;

      // Send full system state to admin
      const seats = seatManager.getSeatDetails();
      const users = sessionManager.getOnlineUsers();
      const bookings = bookingManager.getAllBookings().map(b => ({
        id: b.id,
        seatId: b.seatId,
        userId: b.userId,
        amount: b.amount,
        bookedAt: new Date(b.bookedAt).toISOString(),
        status: b.status
      }));

      socket.emit('admin-init', {
        seats,
        users,
        bookings,
        totalSeats: SEAT_COUNT,
        ticketPrice: TICKET_PRICE,
        paymentFail: PaymentProcessor.isForceFail()
      });
    });

    // ── ADMIN RESET SEATS ──
    socket.on('reset-seats', () => {
      if (!socket.data.isAdmin) {
        socket.emit('admin-err', 'Unauthorized');
        return;
      }

      // Cancel all timers
      timeoutWatcher.cancelAll();

      // Reset all seats
      const count = seatManager.resetAll();

      // Clear all bookings
      bookingManager.resetAll();

      console.log(`[Admin] ${socket.id} reset ${count} seats`);

      // Notify ALL clients that all seats are free
      io.emit('reset-all', { count });

      socket.emit('admin-ok', `Reset ${count} seats successfully`);

      // Send updated state to admin
      const seats = seatManager.getSeatDetails();
      const users = sessionManager.getOnlineUsers();
      const bookings = bookingManager.getAllBookings().map(b => ({
        id: b.id,
        seatId: b.seatId,
        userId: b.userId,
        amount: b.amount,
        bookedAt: new Date(b.bookedAt).toISOString(),
        status: b.status
      }));
      socket.emit('admin-update', { seats, users, bookings });
    });

    // ── ADMIN REFRESH ──
    socket.on('admin-refresh', () => {
      if (!socket.data.isAdmin) {
        socket.emit('admin-err', 'Unauthorized');
        return;
      }

      const seats = seatManager.getSeatDetails();
      const users = sessionManager.getOnlineUsers();
      const bookings = bookingManager.getAllBookings().map(b => ({
        id: b.id,
        seatId: b.seatId,
        userId: b.userId,
        amount: b.amount,
        bookedAt: new Date(b.bookedAt).toISOString(),
        status: b.status
      }));
      socket.emit('admin-update', { seats, users, bookings });
    });

    // ── ADMIN TOGGLE PAYMENT FAIL ──
    socket.on('toggle-payment-fail', () => {
      if (!socket.data.isAdmin) {
        socket.emit('admin-err', 'Unauthorized');
        return;
      }

      PaymentProcessor.setForceFail(!PaymentProcessor.isForceFail());

      const state = PaymentProcessor.isForceFail();
      const msg = state
        ? 'Force-fail ON — all payments will be DECLINED (rollback demo)'
        : 'Force-fail OFF — payments succeed normally';
      console.log(`[Admin] ${msg}`);
      socket.emit('admin-ok', msg);
      socket.emit('payment-fail-state', { forceFail: state });
    });
  });

  console.log('[SocketHandler] All event handlers attached');
}

module.exports = { attachHandlers };
