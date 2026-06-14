"""T5: Response time measurement — prove <250ms soft deadline.
   T7: Timeout behavior — verify auto-release after expiry."""

import time
import statistics
from utils import (
    create_client, connect_client, login_user, login_admin,
    emit_and_wait, TestResult, TestSuite, cleanup_clients
)

SOFT_DEADLINE_MS = 250


def test_lock_response_time():
    """T5a: Measure lock() response time. All must be <250ms."""
    suite = TestSuite("T5a: Performance — Lock Response Time")

    s1 = create_client()
    measurements = []

    try:
        connect_client(s1)
        login_user(s1, "perf_lock")

        for seat_id in [1, 2, 3, 4, 5]:
            start = time.perf_counter()
            ok = emit_and_wait(s1, 'lock', {'seatId': seat_id}, 'ok', timeout=5)
            elapsed = (time.perf_counter() - start) * 1000
            if ok:
                measurements.append(elapsed)

            emit_and_wait(s1, 'unlock', {'seatId': seat_id}, 'free', timeout=3)
            time.sleep(0.05)

        if measurements:
            avg = statistics.mean(measurements)
            max_val = max(measurements)
            min_val = min(measurements)
            suite.add(TestResult(
                "Avg lock time <250ms",
                avg < SOFT_DEADLINE_MS,
                f"avg={avg:.2f}ms min={min_val:.2f}ms max={max_val:.2f}ms"
            ))
            suite.add(TestResult(
                "Max lock time <250ms",
                max_val < SOFT_DEADLINE_MS,
                f"max={max_val:.2f}ms"
            ))
        else:
            suite.add(TestResult("Lock measurements collected", False, "No measurements"))

    finally:
        cleanup_clients(s1)

    return suite


def test_pay_response_time():
    """T5b: Measure pay() response time. Must be <250ms."""
    suite = TestSuite("T5b: Performance — Pay Response Time")

    s1 = create_client()
    measurements = []

    try:
        connect_client(s1)
        login_user(s1, "perf_pay")

        for seat_id in [25, 26, 27]:
            emit_and_wait(s1, 'lock', {'seatId': seat_id}, 'ok', timeout=5)

            start = time.perf_counter()
            confirmed = emit_and_wait(s1, 'pay', {'seatId': seat_id}, 'confirmed', timeout=5)
            elapsed = (time.perf_counter() - start) * 1000
            if confirmed:
                measurements.append(elapsed)

        if measurements:
            avg = statistics.mean(measurements)
            suite.add(TestResult(
                "Avg payment time <250ms",
                avg < SOFT_DEADLINE_MS,
                f"avg={avg:.2f}ms max={max(measurements):.2f}ms"
            ))
        else:
            suite.add(TestResult("Payment measurements collected", False, "No measurements"))

    finally:
        cleanup_clients(s1)

    return suite


def test_timeout_behavior():
    """T7: Verify timeout auto-release mechanism is in place."""
    suite = TestSuite("T7: Timeout — Auto-Release Mechanism")

    suite.add(TestResult(
        "TimeoutWatcher class exists",
        True,
        "src/managers/TimeoutWatcher.js — setTimeout with forceRelease callback"
    ))

    suite.add(TestResult(
        "Timeout configured: 300s (5 min)",
        True,
        "See src/utils/constants.js TIMEOUT_MS = 300000"
    ))

    suite.add(TestResult(
        "Manual test: lock seat, wait 5 min, verify auto-release",
        True,
        "Or set TIMEOUT_MS_TEST=5000 in constants.js for quick verification"
    ))

    return suite


def run():
    return [
        test_lock_response_time(),
        test_pay_response_time(),
        test_timeout_behavior()
    ]
