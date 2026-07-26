"""Small dependency-free CI load smoke test for public read endpoints."""

from concurrent.futures import ThreadPoolExecutor, as_completed
import os
from statistics import quantiles
import time
from urllib.request import Request, urlopen


BASE_URL = os.getenv('LOAD_TEST_BASE_URL', 'http://localhost:8000').rstrip('/')
REQUEST_COUNT = int(os.getenv('LOAD_TEST_REQUEST_COUNT', '100'))
CONCURRENCY = int(os.getenv('LOAD_TEST_CONCURRENCY', '10'))
P95_BUDGET_MS = float(os.getenv('LOAD_TEST_P95_BUDGET_MS', '1500'))
PATHS = (
    '/api/health/',
    '/api/public/reports/?page_size=20',
    '/api/assistant/found-cat/decision-tree/',
)


def validate_configuration():
    if REQUEST_COUNT < 2:
        raise SystemExit(
            'LOAD_TEST_REQUEST_COUNT must be at least 2 to calculate p95 '
            f'(got {REQUEST_COUNT})'
        )
    if CONCURRENCY < 1:
        raise SystemExit(
            f'LOAD_TEST_CONCURRENCY must be at least 1 (got {CONCURRENCY})'
        )
    if P95_BUDGET_MS <= 0:
        raise SystemExit(
            f'LOAD_TEST_P95_BUDGET_MS must be greater than 0 (got {P95_BUDGET_MS})'
        )


def fetch(index):
    started_at = time.monotonic()
    request = Request(
        f'{BASE_URL}{PATHS[index % len(PATHS)]}',
        headers={'Accept': 'application/json'},
    )
    with urlopen(request, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError(f'Unexpected HTTP status {response.status}')
        response.read()
    return (time.monotonic() - started_at) * 1000


def main():
    validate_configuration()
    durations = []
    failures = []
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(fetch, index) for index in range(REQUEST_COUNT)]
        for future in as_completed(futures):
            try:
                durations.append(future.result())
            except Exception as exc:
                failures.append(str(exc))

    if failures:
        raise SystemExit(f'Load smoke test had {len(failures)} failures: {failures[:3]}')
    p95_ms = quantiles(durations, n=100, method='inclusive')[94]
    print(
        f'load-smoke requests={len(durations)} concurrency={CONCURRENCY} '
        f'p95_ms={p95_ms:.2f} budget_ms={P95_BUDGET_MS:.2f}'
    )
    if p95_ms > P95_BUDGET_MS:
        raise SystemExit(
            f'Load smoke p95 {p95_ms:.2f}ms exceeded {P95_BUDGET_MS:.2f}ms budget'
        )


if __name__ == '__main__':
    main()
