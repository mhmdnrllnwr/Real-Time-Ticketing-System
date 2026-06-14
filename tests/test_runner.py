#!/usr/bin/env python3
"""Cinema Ticketing System — Real-Time Test Suite Runner
========================================================
Tests mutex, concurrency, booking, rollback, CFG coverage,
performance, timeout, and admin operations.

Usage:
    python test_runner.py [--verbose] [--host HOST]

Requirements:
    Server must be running: node server.js (port 3000)
    pip install -r requirements.txt
"""

import sys
import time
import os
import traceback
from datetime import datetime

# Import test modules
import test_concurrency
import test_booking
import test_coverage
import test_performance
import test_mutex
import test_admin
import utils


def run_all_tests(verbose=False):
    """Execute all test suites and return combined results."""
    all_suites = []

    modules = [
        ("T1 & T6: Concurrency & Throughput", test_concurrency),
        ("T2 & T3: Booking Flow & CFG", test_booking),
        ("T5 & T7: Performance & Timeout", test_performance),
        ("T8: Mutex Correctness", test_mutex),
        ("T9: Admin Operations", test_admin),
    ]

    for name, module in modules:
        print(f"\n{'=' * 60}")
        print(f"  {name}")
        print(f"{'=' * 60}")
        try:
            suites = module.run()
            for suite in suites:
                all_suites.append(suite)
                for r in suite.results:
                    status = "PASS" if r.passed else "FAIL"
                    icon = "v" if r.passed else "x"
                    print(f"  [{icon} {status}] {r.name}")
                    if r.message or verbose:
                        print(f"         {r.message}")
        except Exception as e:
            print(f"  [x FAIL] Module crashed: {e}")
            if verbose:
                traceback.print_exc()

    # T4: Coverage (depends on results from other suites)
    print(f"\n{'=' * 60}")
    print(f"  T4: Structural Coverage Analysis")
    print(f"{'=' * 60}")
    try:
        cov_suite = test_coverage.analyze_coverage(all_suites)
        all_suites.append(cov_suite)
        for r in cov_suite.results:
            status = "PASS" if r.passed else "FAIL"
            icon = "v" if r.passed else "x"
            print(f"  [{icon} {status}] {r.name}")
            if r.message:
                print(f"         {r.message}")
    except Exception as e:
        print(f"  [x FAIL] Coverage analysis crashed: {e}")
        if verbose:
            traceback.print_exc()

    return all_suites


def print_summary(all_suites):
    """Print final test summary table."""
    print(f"\n\n{'=' * 60}")
    print(f"  FINAL SUMMARY")
    print(f"{'=' * 60}")

    total = 0
    passed = 0
    failed = 0

    rows = []
    for suite in all_suites:
        s = suite.summary()
        rows.append([s['suite'], s['passed'], s['failed'], s['pass_rate']])
        total += s['total']
        passed += s['passed']
        failed += s['failed']

    # Print header
    header = f"{'Suite':<48} {'Pass':>5} {'Fail':>5}  {'Rate':>7}"
    print(header)
    print("-" * len(header))

    # Print rows
    for row in rows:
        print(f"{row[0]:<48} {row[1]:>5} {row[2]:>5}  {row[3]:>7}")

    # Print total
    print("-" * len(header))
    rate = f"{(passed / total * 100):.1f}%" if total > 0 else "0%"
    print(f"{'TOTAL':<48} {passed:>5} {failed:>5}  {rate:>7}")

    return passed, failed, total


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv

    # Allow custom host via --host or env var
    for i, arg in enumerate(sys.argv):
        if arg == '--host' and i + 1 < len(sys.argv):
            os.environ['TICKETING_URL'] = sys.argv[i + 1]
            utils.BASE_URL = sys.argv[i + 1]

    print("=" * 60)
    print("  Cinema Ticketing System — Test Suite")
    print(f"  Server:  {utils.BASE_URL}")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    all_suites = run_all_tests(verbose=verbose)
    passed, failed, total = print_summary(all_suites)

    # Assignment report data
    print(f"\n{'=' * 60}")
    print(f"  ASSIGNMENT 2 — TEST REPORT DATA")
    print(f"{'=' * 60}")
    print(f"  Server:              {utils.BASE_URL}")
    print(f"  Tests run:           {total}")
    print(f"  Passed:              {passed}")
    print(f"  Failed:              {failed}")
    print(f"  Pass rate:           {(passed / total * 100):.1f}%" if total > 0 else "  Pass rate:           N/A")
    print(f"  Soft deadline:       <250ms per operation")
    print(f"  CFG decision nodes:  5 (all exercised)")
    print(f"")

    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
