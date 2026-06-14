"""Shared test utilities for Cinema Ticketing System test suite."""

import socketio
import time
import os

BASE_URL = os.environ.get("TICKETING_URL", "http://localhost:3000")
ADMIN_PASSWORD = "admin123"
TIMEOUT = 10


class TestResult:
    def __init__(self, name, passed, message="", data=None):
        self.name = name
        self.passed = passed
        self.message = message
        self.data = data or {}


class TestSuite:
    def __init__(self, name):
        self.name = name
        self.results = []

    def add(self, result):
        self.results.append(result)

    def passed(self):
        return [r for r in self.results if r.passed]

    def failed(self):
        return [r for r in self.results if not r.passed]

    def summary(self):
        total = len(self.results)
        p = len(self.passed())
        return {
            "suite": self.name,
            "total": total,
            "passed": p,
            "failed": total - p,
            "pass_rate": f"{(p / total * 100):.1f}%" if total > 0 else "0%"
        }


def create_client():
    """Create a Socket.IO client."""
    return socketio.Client()


def connect_client(sio):
    """Connect to server."""
    try:
        sio.connect(BASE_URL, transports=['websocket'], wait_timeout=TIMEOUT)
        return True
    except Exception as e:
        print(f"    Connection failed: {e}")
        return False


def emit_and_wait(sio, event, payload, response_event, timeout=TIMEOUT):
    """Emit an event and wait for a response. Sets listener BEFORE emit."""
    result = {}

    @sio.on(response_event)
    def handler(d):
        result.update(d if isinstance(d, dict) else {'value': d})

    sio.emit(event, payload)

    start = time.time()
    while not result and (time.time() - start) < timeout:
        time.sleep(0.02)
    return result if result else None


def emit_and_wait_multi(sio, event, payload, response_events, timeout=TIMEOUT):
    """Emit and wait for any of multiple response events. Returns (event_name, data)."""
    results = {}

    for ev_name in response_events:
        @sio.on(ev_name)
        def handler(d, name=ev_name):
            results[name] = d if isinstance(d, dict) else {'value': d}

    sio.emit(event, payload)

    start = time.time()
    while not results and (time.time() - start) < timeout:
        time.sleep(0.02)
    for name, data in results.items():
        return name, data
    return None, None


def login_user(sio, username):
    """Login as regular user. Sets up listener before emit."""
    data = {}

    @sio.on('init')
    def on_init(d):
        data.update(d)

    sio.emit('login', {'username': username})
    start = time.time()
    while not data.get('username') and (time.time() - start) < TIMEOUT:
        time.sleep(0.02)
    return data if data.get('username') else None


def login_admin(sio, password=ADMIN_PASSWORD):
    """Login as admin. Sets up listener before emit."""
    data = {}
    error = {}

    @sio.on('admin-init')
    def on_init(d):
        data.update(d)

    @sio.on('admin-err')
    def on_err(d):
        error['msg'] = d if isinstance(d, str) else d.get('value', 'Unknown error')

    sio.emit('admin-login', {'password': password})
    start = time.time()
    while not data and not error and (time.time() - start) < TIMEOUT:
        time.sleep(0.02)
    if error:
        return {'error': error.get('msg', 'Unknown admin error')}
    return data if data else None


def cleanup_clients(*clients):
    """Disconnect all test clients."""
    for c in clients:
        try:
            if hasattr(c, 'connected') and c.connected:
                c.disconnect()
        except Exception:
            pass
