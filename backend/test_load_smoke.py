import pytest

import load_smoke


@pytest.mark.parametrize('request_count', [0, 1])
def test_main_rejects_too_few_requests(monkeypatch, request_count):
    monkeypatch.setattr(load_smoke, 'REQUEST_COUNT', request_count)

    with pytest.raises(
        SystemExit,
        match=(
            rf'LOAD_TEST_REQUEST_COUNT must be at least 2 to calculate p95 '
            rf'\(got {request_count}\)'
        ),
    ):
        load_smoke.main()


def test_main_calculates_p95_with_two_requests(monkeypatch, capsys):
    durations = iter([10.0, 20.0])
    monkeypatch.setattr(load_smoke, 'REQUEST_COUNT', 2)
    monkeypatch.setattr(load_smoke, 'CONCURRENCY', 1)
    monkeypatch.setattr(load_smoke, 'P95_BUDGET_MS', 100.0)
    monkeypatch.setattr(load_smoke, 'fetch', lambda _index: next(durations))

    load_smoke.main()

    assert 'requests=2' in capsys.readouterr().out
