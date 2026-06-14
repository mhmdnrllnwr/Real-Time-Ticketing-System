"""T1: Mutex concurrency — multiple clients competing for same seat.
   T6: Throughput — N clients locking M distinct seats."""

import time
from utils import (
    create_client, connect_client, login_user,
    emit_and_wait, TestResult, TestSuite, cleanup_clients, TIMEOUT
)


def test_mutex_same_seat():
    """T1: Two clients try same seat. First wins, second denied."""
    suite = TestSuite("T1: Mutex — Same Seat Denial")

    s1 = create_client()
    s2 = create_client()

    try:
        connect_client(s1)
        connect_client(s2)
        login_user(s1, "user_a")
        login_user(s2, "user_b")

        # First client locks seat 10
        ok1 = emit_and_wait(s1, 'lock', {'seatId': 10}, 'ok', timeout=5)
        suite.add(TestResult(
            "User A locks seat 10",
            ok1 is not None,
            f"OK seatId={ok1.get('seatId')}" if ok1 else "No OK received"
        ))

        # Second client tries same seat — must be denied
        err2 = emit_and_wait(s2, 'lock', {'seatId': 10}, 'err', timeout=5)
        suite.add(TestResult(
            "User B denied (seat already locked)",
            err2 is not None and any(w in str(err2).lower() for w in ['locked', 'cannot', 'resource']),
            str(err2) if err2 else "No error received"
        ))

        # Clean up
        emit_and_wait(s1, 'unlock', {'seatId': 10}, 'free', timeout=5)

    finally:
        cleanup_clients(s1, s2)

    return suite


def test_mutex_different_seats():
    """T1b: Two clients lock different seats — both succeed."""
    suite = TestSuite("T1b: Mutex — Different Seats OK")

    s1 = create_client()
    s2 = create_client()

    try:
        connect_client(s1)
        connect_client(s2)
        login_user(s1, "user_c")
        login_user(s2, "user_d")

        ok1 = emit_and_wait(s1, 'lock', {'seatId': 1}, 'ok', timeout=5)
        ok2 = emit_and_wait(s2, 'lock', {'seatId': 2}, 'ok', timeout=5)

        suite.add(TestResult("User C locks seat 1", ok1 is not None))
        suite.add(TestResult("User D locks seat 2", ok2 is not None))

        emit_and_wait(s1, 'unlock', {'seatId': 1}, 'free', timeout=5)
        emit_and_wait(s2, 'unlock', {'seatId': 2}, 'free', timeout=5)

    finally:
        cleanup_clients(s1, s2)

    return suite


def test_throughput_n_clients():
    """T6: 5 clients lock 5 different seats concurrently. Measure total time."""
    suite = TestSuite("T6: Throughput — 5 Concurrent Locks")

    NUM_CLIENTS = 5
    clients = []

    try:
        for i in range(NUM_CLIENTS):
            c = create_client()
            connect_client(c)
            login_user(c, f"perf_user_{i}")
            clients.append(c)

        results = {}
        start = time.perf_counter()

        # Set up listeners then emit all in parallel
        for i, c in enumerate(clients):
            seat_id = 20 + i
            idx = i  # capture value

            def handler(d, i=idx):
                results[i] = True

            c.on('ok', handler)
            c.emit('lock', {'seatId': seat_id})

        # Wait for all
        deadline = time.time() + TIMEOUT
        while len(results) < NUM_CLIENTS and time.time() < deadline:
            time.sleep(0.02)

        elapsed = (time.perf_counter() - start) * 1000
        all_ok = len(results) == NUM_CLIENTS

        suite.add(TestResult(
            f"All {NUM_CLIENTS} clients locked seats",
            all_ok,
            f"Elapsed: {elapsed:.2f}ms total — {len(results)}/{NUM_CLIENTS} succeeded"
        ))

        # Clean up
        for i, c in enumerate(clients):
            emit_and_wait(c, 'unlock', {'seatId': 20 + i}, 'free', timeout=3)

    finally:
        cleanup_clients(*clients)

    return suite


def run():
    return [
        test_mutex_same_seat(),
        test_mutex_different_seats(),
        test_throughput_n_clients()
    ]
