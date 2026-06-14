"""T8: Mutex correctness — owner-only release, force-release,
   deadlock prevention via release-before-acquire."""

import time
from utils import (
    create_client, connect_client, login_user,
    emit_and_wait, TestResult, TestSuite, cleanup_clients
)


def test_owner_only_release():
    """Verify only lock owner can release a locked seat."""
    suite = TestSuite("T8a: Mutex — Owner-Only Release")

    s1 = create_client()
    s2 = create_client()

    try:
        connect_client(s1)
        connect_client(s2)
        login_user(s1, "owner")
        login_user(s2, "intruder")

        # S1 locks seat 1
        ok = emit_and_wait(s1, 'lock', {'seatId': 1}, 'ok', timeout=5)
        suite.add(TestResult(
            "Owner locks seat 1",
            ok is not None
        ))

        # S2 tries to unlock seat 1 — must fail
        err = emit_and_wait(s2, 'unlock', {'seatId': 1}, 'err', timeout=5)
        suite.add(TestResult(
            "Intruder cannot unlock owner seat",
            err is not None and ('lock' in str(err).lower() or 'not' in str(err).lower()),
            str(err)
        ))

        # S1 can unlock successfully
        free = emit_and_wait(s1, 'unlock', {'seatId': 1}, 'free', timeout=5)
        suite.add(TestResult(
            "Owner can unlock own seat",
            free is not None and free.get('seatId') == 1
        ))

    finally:
        cleanup_clients(s1, s2)

    return suite


def test_release_before_acquire():
    """Verify deadlock prevention: locking new seat releases previous lock."""
    suite = TestSuite("T8b: Deadlock Prevention — Release-Before-Acquire")

    s1 = create_client()
    s2 = create_client()

    try:
        connect_client(s1)
        connect_client(s2)
        login_user(s1, "switcher")
        login_user(s2, "observer")

        # S1 locks seat 10
        ok1 = emit_and_wait(s1, 'lock', {'seatId': 10}, 'ok', timeout=5)
        suite.add(TestResult("S1 locks seat 10", ok1 is not None))

        # S1 switches to seat 20 — must auto-release seat 10
        ok2 = emit_and_wait(s1, 'lock', {'seatId': 20}, 'ok', timeout=5)
        suite.add(TestResult("S1 switches to seat 20", ok2 is not None))

        # Seat 10 should now be free — S2 can lock it
        time.sleep(0.1)
        ok3 = emit_and_wait(s2, 'lock', {'seatId': 10}, 'ok', timeout=5)
        suite.add(TestResult(
            "S2 can lock seat 10 (S1 auto-released)",
            ok3 is not None,
            "Release-before-acquire deadlock prevention working"
        ))

        emit_and_wait(s1, 'unlock', {'seatId': 20}, 'free', timeout=5)
        emit_and_wait(s2, 'unlock', {'seatId': 10}, 'free', timeout=5)

    finally:
        cleanup_clients(s1, s2)

    return suite


def run():
    return [
        test_owner_only_release(),
        test_release_before_acquire()
    ]
