"""T9: Admin operations — login security, reset seats, force-fail toggle."""

import time
from utils import (
    create_client, connect_client, login_user, login_admin,
    emit_and_wait, TestResult, TestSuite, cleanup_clients
)


def test_admin_auth():
    """Verify admin authentication — wrong password rejected, correct accepted."""
    suite = TestSuite("T9a: Admin — Authentication")

    # Wrong password
    s1 = create_client()
    try:
        connect_client(s1)
        data = login_admin(s1, password="wrong_password")
        suite.add(TestResult(
            "Wrong password rejected",
            data is not None and 'error' in data,
            str(data)
        ))
    finally:
        cleanup_clients(s1)

    # Correct password
    s2 = create_client()
    try:
        connect_client(s2)
        data = login_admin(s2)
        suite.add(TestResult(
            "Correct password accepted",
            data is not None and 'seats' in data,
            f"Seats: {len(data.get('seats', []))}, Users: {len(data.get('users', []))}" if data else "No data"
        ))
    finally:
        cleanup_clients(s2)

    return suite


def test_admin_reset():
    """Verify admin reset clears all state and notifies users."""
    suite = TestSuite("T9b: Admin — Reset Seats")

    user = create_client()
    admin = create_client()

    try:
        connect_client(user)
        connect_client(admin)
        login_user(user, "reset_user")
        login_admin(admin)

        # Book a seat
        ok = emit_and_wait(user, 'lock', {'seatId': 1}, 'ok', timeout=5)
        suite.add(TestResult("User locks seat 1", ok is not None))

        confirmed = emit_and_wait(user, 'pay', {'seatId': 1}, 'confirmed', timeout=5)
        suite.add(TestResult("User books seat 1", confirmed is not None))

        # Set up reset listener BEFORE emit
        reset_data = {}

        @user.on('reset-all')
        def on_reset(d):
            reset_data.update(d if isinstance(d, dict) else {'value': d})

        # Admin resets
        ok_msg = emit_and_wait(admin, 'reset-seats', {}, 'admin-ok', timeout=5)
        update = emit_and_wait(admin, 'reset-seats', {}, 'admin-update', timeout=5)

        suite.add(TestResult(
            "Reset acknowledged by admin",
            ok_msg is not None,
            str(ok_msg)
        ))

        # Check reset notification
        time.sleep(0.3)
        suite.add(TestResult(
            "User received reset notification",
            bool(reset_data),
            f"Cleared {reset_data.get('count', '?')} seats" if reset_data else "No reset event"
        ))

        # Refresh admin to check state
        # Reconnect admin for clean state
        admin.disconnect()
        time.sleep(0.1)
        admin.connect("http://localhost:3000", transports=['websocket'], wait_timeout=5)
        data = login_admin(admin)

        all_available = True
        if data and 'seats' in data:
            all_available = all(s['status'] == 'AVAILABLE' for s in data['seats'])
        suite.add(TestResult(
            "All seats AVAILABLE after reset",
            data is not None and all_available,
            f"Bookings: {len(data.get('bookings', []))} (should be 0)" if data else "No data"
        ))

    finally:
        cleanup_clients(user, admin)

    return suite


def test_force_fail_toggle():
    """Verify admin can toggle payment force-fail mode."""
    suite = TestSuite("T9c: Admin — Force-Fail Toggle")

    admin = create_client()
    try:
        connect_client(admin)
        login_admin(admin)

        state1 = emit_and_wait(admin, 'toggle-payment-fail', {}, 'payment-fail-state', timeout=5)
        suite.add(TestResult(
            "Force-fail toggled ON",
            state1 is not None and state1.get('forceFail') is True
        ))

        state2 = emit_and_wait(admin, 'toggle-payment-fail', {}, 'payment-fail-state', timeout=5)
        suite.add(TestResult(
            "Force-fail toggled OFF",
            state2 is not None and state2.get('forceFail') is False
        ))

    finally:
        cleanup_clients(admin)

    return suite


def test_unauthorized_actions():
    """Verify unauthenticated admin actions are rejected."""
    suite = TestSuite("T9d: Admin — Unauthorized Actions")

    user = create_client()
    try:
        connect_client(user)
        login_user(user, "fake_admin")

        err = emit_and_wait(user, 'reset-seats', {}, 'admin-err', timeout=5)
        suite.add(TestResult(
            "Regular user cannot reset seats",
            err is not None and 'unauthorized' in str(err).lower(),
            str(err)
        ))

    finally:
        cleanup_clients(user)

    return suite


def run():
    return [
        test_admin_auth(),
        test_admin_reset(),
        test_force_fail_toggle(),
        test_unauthorized_actions()
    ]
