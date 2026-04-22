from collections.abc import Callable
from datetime import date
import json
from pathlib import Path
import tempfile
from typing import Any

from .errors import DailyGoogleRequestLimitExceeded


class GoogleRequestQuota:
    def __init__(
        self,
        state_path: str | Path,
        daily_limit: int,
        today: Callable[[], date] = date.today,
    ) -> None:
        self.state_path = Path(state_path)
        self.daily_limit = daily_limit
        self.today = today

    def reserve(self, provider: str) -> None:
        state = self._read_state()
        today = self.today().isoformat()

        if state.get("date") != today:
            state = {"date": today, "count": 0, "providers": {}}

        count = int(state.get("count", 0))
        if count >= self.daily_limit:
            raise DailyGoogleRequestLimitExceeded(
                f"Daily Google request limit reached ({count}/{self.daily_limit})"
            )

        providers = state.setdefault("providers", {})
        providers[provider] = int(providers.get(provider, 0)) + 1
        state["count"] = count + 1
        self._write_state(state)

    def _read_state(self) -> dict[str, Any]:
        if not self.state_path.exists():
            return {}

        try:
            data = json.loads(self.state_path.read_text())
        except json.JSONDecodeError:
            return {}

        return data if isinstance(data, dict) else {}

    def _write_state(self, state: dict[str, Any]) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            "w",
            dir=self.state_path.parent,
            delete=False,
        ) as temporary_file:
            json.dump(state, temporary_file, sort_keys=True)
            temporary_path = Path(temporary_file.name)

        temporary_path.replace(self.state_path)
