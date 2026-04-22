import json
from datetime import date

import pytest

from ingestion.google_places.errors import DailyGoogleRequestLimitExceeded
from ingestion.google_places.quota import GoogleRequestQuota


def test_quota_reserves_requests_until_daily_limit(tmp_path):
    state_path = tmp_path / "quota.json"
    quota = GoogleRequestQuota(
        state_path=state_path,
        daily_limit=2,
        today=lambda: date(2026, 4, 22),
    )

    quota.reserve("places")
    quota.reserve("geocoding")

    state = json.loads(state_path.read_text())
    assert state["date"] == "2026-04-22"
    assert state["count"] == 2
    assert state["providers"] == {"places": 1, "geocoding": 1}


def test_quota_blocks_requests_after_daily_limit(tmp_path):
    quota = GoogleRequestQuota(
        state_path=tmp_path / "quota.json",
        daily_limit=1,
        today=lambda: date(2026, 4, 22),
    )

    quota.reserve("places")

    with pytest.raises(DailyGoogleRequestLimitExceeded, match="1000|1"):
        quota.reserve("geocoding")


def test_quota_resets_when_day_changes(tmp_path):
    state_path = tmp_path / "quota.json"
    state_path.write_text(
        json.dumps(
            {
                "date": "2026-04-21",
                "count": 1000,
                "providers": {"places": 700, "geocoding": 300},
            }
        )
    )
    quota = GoogleRequestQuota(
        state_path=state_path,
        daily_limit=1000,
        today=lambda: date(2026, 4, 22),
    )

    quota.reserve("places")

    state = json.loads(state_path.read_text())
    assert state["date"] == "2026-04-22"
    assert state["count"] == 1
    assert state["providers"] == {"places": 1}
