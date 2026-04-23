import logging

from ingestion.google_places.client import GooglePlacesClient
from ingestion.google_places.geocoding import GoogleGeocodingClient
from ingestion.google_places.quota import GoogleRequestQuota
from workers.config.settings import WorkerSettings
from workers.observability import log_event
from workers.pipeline import WorkerPipeline
from workers.repository import WorkerRepository


def main() -> None:
    settings = WorkerSettings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required to process search runs")

    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(message)s",
    )
    logger = logging.getLogger(__name__)

    quota = GoogleRequestQuota(
        state_path=settings.google_quota_state_path,
        daily_limit=settings.google_daily_request_limit,
    )
    pipeline = WorkerPipeline(
        repository=WorkerRepository(settings.database_url),
        places_client=GooglePlacesClient(
            api_key=settings.google_places_api_key,
            quota=quota,
            timeout_seconds=settings.google_request_timeout_seconds,
        ),
        geocoding_client=GoogleGeocodingClient(
            api_key=settings.effective_google_geocoding_api_key,
            quota=quota,
            timeout_seconds=settings.google_request_timeout_seconds,
        ),
    )

    processed_runs = 0
    while True:
        result = pipeline.process_next_pending_search_run()
        if result is None:
            break
        processed_runs += 1

    print(
        "Business Lead Finder workers finished "
        f"(env={settings.app_env}, processed_runs={processed_runs})"
    )
    log_event(
        logger,
        logging.INFO,
        "worker_finished",
        provider="google_places",
        result_count=processed_runs,
    )


if __name__ == "__main__":
    main()
