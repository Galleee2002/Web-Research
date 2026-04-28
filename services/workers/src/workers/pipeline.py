from datetime import UTC, datetime
import logging

from ingestion.google_places.errors import GoogleGeocodingStatusError
from ingestion.google_places.adapter import extract_places

from .models import SearchRun, SearchRunProcessingResult
from .normalization import normalize_google_place
from .observability import classify_error_code, log_event, redact_sensitive_text, utc_now_iso

logger = logging.getLogger(__name__)


class WorkerPipeline:
    def __init__(self, repository, places_client, geocoding_client) -> None:
        self.repository = repository
        self.places_client = places_client
        self.geocoding_client = geocoding_client

    def process_next_pending_search_run(self) -> SearchRunProcessingResult | None:
        search_run = self.repository.claim_next_pending_search_run()
        if search_run is None:
            return None

        return self.process_claimed_search_run(search_run)

    def process_claimed_search_run(
        self,
        search_run: SearchRun,
    ) -> SearchRunProcessingResult:
        started_at = datetime.now(UTC)
        started_at_iso = utc_now_iso()
        log_event(
            logger,
            logging.INFO,
            "places_request_started",
            correlation_id=search_run.correlation_id,
            search_run_id=search_run.id,
            provider=search_run.source,
            error_stage="places",
        )
        try:
            places_started_at = datetime.now(UTC)
            places_response = self.places_client.search_text(
                search_run.query,
                search_run.location,
                page_token=search_run.provider_page_token,
            )
            raw_places = extract_places(places_response)
            next_page_token = places_response.get("nextPageToken")
            if not isinstance(next_page_token, str) or not next_page_token.strip():
                next_page_token = None
            places_duration_ms = int(
                (datetime.now(UTC) - places_started_at).total_seconds() * 1000
            )
            normalized_businesses = []
            geocoding_calls = 0
            for raw_place in raw_places:
                geocoding_response, used_geocoding = self._maybe_geocode_place(
                    search_run,
                    raw_place,
                )
                geocoding_calls += 1 if used_geocoding else 0
                normalized_business = normalize_google_place(raw_place, geocoding_response)
                normalized_businesses.append(normalized_business)
                log_event(
                    logger,
                    logging.INFO,
                    "business_normalized",
                    correlation_id=search_run.correlation_id,
                    search_run_id=search_run.id,
                    provider=normalized_business.source,
                    error_stage="normalize",
                    result_count=1,
                    business_external_id=normalized_business.external_id,
                )

            duration_ms = int((datetime.now(UTC) - started_at).total_seconds() * 1000)
            finished_at_iso = utc_now_iso()
            observability = {
                "provider": search_run.source,
                "page_number": search_run.page_number,
                "parent_search_run_id": search_run.parent_search_run_id,
                "provider_page_token_present": bool(search_run.provider_page_token),
                "provider_next_page_available": bool(next_page_token),
                "results_found": len(raw_places),
                "inserted_count": 0,
                "updated_count": 0,
                "deduped_count": 0,
                "geocoding_calls": geocoding_calls,
                "duration_ms": duration_ms,
                "started_at": started_at_iso,
                "finished_at": finished_at_iso,
                "places_search_duration_ms": places_duration_ms,
            }
            upsert_results = self.repository.persist_search_run_results(
                search_run,
                normalized_businesses,
                len(raw_places),
                observability,
                provider_next_page_token=next_page_token,
            )
            inserted_count = sum(1 for result in upsert_results if result.action == "inserted")
            updated_count = sum(1 for result in upsert_results if result.action == "updated")
            deduped_count = sum(1 for result in upsert_results if result.dedupe_strategy)
            observability.update(
                {
                    "inserted_count": inserted_count,
                    "updated_count": updated_count,
                    "deduped_count": deduped_count,
                }
            )
            observability = {**observability}
            log_event(
                logger,
                logging.INFO,
                "search_run_completed",
                correlation_id=search_run.correlation_id,
                search_run_id=search_run.id,
                provider=search_run.source,
                error_stage="persist",
                duration_ms=duration_ms,
                result_count=len(raw_places),
            )
            return SearchRunProcessingResult(
                search_run_id=search_run.id,
                correlation_id=search_run.correlation_id,
                status="completed",
                total_found=len(raw_places),
                inserted_count=inserted_count,
                updated_count=updated_count,
                deduped_count=deduped_count,
                geocoding_calls=geocoding_calls,
                duration_ms=duration_ms,
                businesses=normalized_businesses,
                observability=observability,
            )
        except Exception as error:
            error_message = self._summarize_error(error)
            error_code = classify_error_code(error)
            error_stage = self._detect_error_stage(error)
            duration_ms = int((datetime.now(UTC) - started_at).total_seconds() * 1000)
            observability = {
                "provider": search_run.source,
                "page_number": search_run.page_number,
                "parent_search_run_id": search_run.parent_search_run_id,
                "provider_page_token_present": bool(search_run.provider_page_token),
                "provider_next_page_available": False,
                "results_found": 0,
                "inserted_count": 0,
                "updated_count": 0,
                "deduped_count": 0,
                "geocoding_calls": 0,
                "duration_ms": duration_ms,
                "started_at": started_at_iso,
                "finished_at": utc_now_iso(),
            }
            log_event(
                logger,
                logging.ERROR,
                "places_request_failed" if error_stage == "places" else "search_run_failed",
                correlation_id=search_run.correlation_id,
                search_run_id=search_run.id,
                provider=search_run.source,
                error_code=error_code,
                error_stage=error_stage,
                duration_ms=duration_ms,
                result_count=0,
                error_message=error_message,
            )
            self.repository.mark_search_run_failed(
                search_run,
                error_message,
                error_code,
                error_stage,
                observability,
            )
            return SearchRunProcessingResult(
                search_run_id=search_run.id,
                correlation_id=search_run.correlation_id,
                status="failed",
                total_found=0,
                inserted_count=0,
                updated_count=0,
                deduped_count=0,
                geocoding_calls=0,
                duration_ms=duration_ms,
                error_message=error_message,
                error_code=error_code,
                error_stage=error_stage,
                businesses=[],
                observability=observability,
            )

    def _maybe_geocode_place(
        self,
        search_run: SearchRun,
        raw_place: dict,
    ) -> tuple[dict | None, bool]:
        address = raw_place.get("formattedAddress")
        if not isinstance(address, str) or not address.strip():
            return None, False

        log_event(
            logger,
            logging.INFO,
            "geocoding_request_started",
            correlation_id=search_run.correlation_id,
            search_run_id=search_run.id,
            provider=search_run.source,
            error_stage="geocoding",
        )

        try:
            return self.geocoding_client.geocode(address), True
        except Exception:
            log_event(
                logger,
                logging.ERROR,
                "geocoding_request_failed",
                correlation_id=search_run.correlation_id,
                search_run_id=search_run.id,
                provider=search_run.source,
                error_stage="geocoding",
            )
            raise

    def _detect_error_stage(self, error: Exception) -> str:
        if isinstance(error, GoogleGeocodingStatusError):
            return "geocoding"
        message = str(error).lower()
        if "geocoding" in message:
            return "geocoding"
        if "places" in message or "google" in message:
            return "places"
        return "persist"

    def _summarize_error(self, error: Exception) -> str:
        message = str(error).strip() or error.__class__.__name__
        return redact_sensitive_text(message)[:500]
