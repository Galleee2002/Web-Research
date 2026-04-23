from collections.abc import Callable
import logging
import re
from typing import Any

import psycopg
from psycopg.rows import dict_row

from contracts import NormalizedBusiness

from .models import SearchRun, UpsertResult
from .observability import log_event


_NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9]+")
logger = logging.getLogger(__name__)


def normalize_dedupe_text(value: str | None) -> str:
    if value is None:
        return ""

    normalized = _NON_ALNUM_PATTERN.sub("", value.strip().lower())
    return normalized


class WorkerRepository:
    def __init__(
        self,
        database_url: str,
        connect: Callable[..., psycopg.Connection[Any]] = psycopg.connect,
    ) -> None:
        self.database_url = database_url
        self.connect = connect

    def claim_next_pending_search_run(self) -> SearchRun | None:
        with self.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.transaction():
                row = connection.execute(
                    """
                    update search_runs
                    set
                      status = 'processing',
                      started_at = coalesce(started_at, now()),
                      finished_at = null,
                      error_message = null,
                      error_code = null,
                      error_stage = null,
                      observability = coalesce(observability, '{}'::jsonb) || jsonb_build_object(
                        'started_at',
                        now() at time zone 'utc',
                        'provider',
                        source
                      ),
                      updated_at = now()
                    where id = (
                      select id
                      from search_runs
                      where status = 'pending'
                      order by created_at asc
                      for update skip locked
                      limit 1
                    )
                    returning
                      id,
                      query,
                      location,
                      source,
                      correlation_id,
                      status,
                      total_found,
                      error_message,
                      error_code,
                      error_stage,
                      observability
                    """
                ).fetchone()

        search_run = self._map_search_run(row) if row else None
        if search_run is not None:
            log_event(
                logger,
                logging.INFO,
                "search_run_claimed",
                correlation_id=search_run.correlation_id,
                search_run_id=search_run.id,
                provider=search_run.source,
                error_stage="claim",
            )

        return search_run

    def persist_search_run_results(
        self,
        search_run: SearchRun,
        businesses: list[NormalizedBusiness],
        total_found: int,
        observability: dict[str, Any],
    ) -> list[UpsertResult]:
        results: list[UpsertResult] = []
        with self.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.transaction():
                for business in businesses:
                    existing, dedupe_strategy = self._find_existing_business(connection, business)
                    if existing is None:
                        inserted = connection.execute(
                            """
                            insert into businesses (
                              search_run_id,
                              external_id,
                              source,
                              name,
                              category,
                              address,
                              city,
                              region,
                              country,
                              lat,
                              lng,
                              phone,
                              website,
                              has_website,
                              maps_url
                            )
                            values (
                              %(search_run_id)s,
                              %(external_id)s,
                              %(source)s,
                              %(name)s,
                              %(category)s,
                              %(address)s,
                              %(city)s,
                              %(region)s,
                              %(country)s,
                              %(lat)s,
                              %(lng)s,
                              %(phone)s,
                              %(website)s,
                              %(has_website)s,
                              %(maps_url)s
                            )
                            returning id
                            """,
                            {
                                "search_run_id": search_run.id,
                                "external_id": business.external_id,
                                "source": business.source,
                                "name": business.name,
                                "category": business.category,
                                "address": business.address,
                                "city": business.city,
                                "region": business.region,
                                "country": business.country,
                                "lat": business.lat,
                                "lng": business.lng,
                                "phone": business.phone,
                                "website": business.website,
                                "has_website": business.has_website,
                                "maps_url": business.maps_url,
                            },
                        ).fetchone()
                        results.append(
                            UpsertResult(
                                action="inserted",
                                business_id=inserted["id"],
                                external_id=business.external_id,
                            )
                        )
                        log_event(
                            logger,
                            logging.INFO,
                            "business_inserted",
                            correlation_id=search_run.correlation_id,
                            search_run_id=search_run.id,
                            provider=business.source,
                            error_stage="persist",
                            result_count=1,
                            business_external_id=business.external_id,
                        )
                        continue

                    payload = self._build_merge_payload(existing, business)
                    connection.execute(
                        """
                        update businesses
                        set
                          external_id = %(external_id)s,
                          category = %(category)s,
                          address = %(address)s,
                          city = %(city)s,
                          region = %(region)s,
                          country = %(country)s,
                          lat = %(lat)s,
                          lng = %(lng)s,
                          phone = %(phone)s,
                          website = %(website)s,
                          has_website = %(has_website)s,
                          maps_url = %(maps_url)s,
                          updated_at = now()
                        where id = %(id)s
                        """,
                        payload,
                    )
                    results.append(
                        UpsertResult(
                            action="updated",
                            business_id=existing["id"],
                            external_id=payload["external_id"],
                            dedupe_strategy=dedupe_strategy,
                        )
                    )
                    log_event(
                        logger,
                        logging.INFO,
                        (
                            "business_deduped_by_external_id"
                            if dedupe_strategy == "external_id"
                            else "business_deduped_by_name_address"
                        ),
                        correlation_id=search_run.correlation_id,
                        search_run_id=search_run.id,
                        provider=business.source,
                        error_stage="persist",
                        result_count=1,
                        business_external_id=payload["external_id"],
                    )
                    log_event(
                        logger,
                        logging.INFO,
                        "business_updated",
                        correlation_id=search_run.correlation_id,
                        search_run_id=search_run.id,
                        provider=business.source,
                        error_stage="persist",
                        result_count=1,
                        business_external_id=payload["external_id"],
                    )

                completed_observability = {
                    **observability,
                    "inserted_count": sum(
                        1 for result in results if result.action == "inserted"
                    ),
                    "updated_count": sum(
                        1 for result in results if result.action == "updated"
                    ),
                    "deduped_count": sum(
                        1 for result in results if result.dedupe_strategy is not None
                    ),
                }
                connection.execute(
                    """
                    update search_runs
                    set
                      status = 'completed',
                      total_found = %s,
                      finished_at = now(),
                      error_message = null,
                      error_code = null,
                      error_stage = null,
                      observability = coalesce(observability, '{}'::jsonb) || %s::jsonb,
                      updated_at = now()
                    where id = %s
                    """,
                    (
                        total_found,
                        psycopg.types.json.Jsonb(completed_observability),
                        search_run.id,
                    ),
                )

        return results

    def mark_search_run_failed(
        self,
        search_run: SearchRun,
        error_message: str,
        error_code: str,
        error_stage: str,
        observability: dict[str, Any],
    ) -> None:
        with self.connect(self.database_url, row_factory=dict_row) as connection:
            with connection.transaction():
                connection.execute(
                    """
                    update search_runs
                    set
                      status = 'failed',
                      error_message = %s,
                      error_code = %s,
                      error_stage = %s,
                      observability = coalesce(observability, '{}'::jsonb) || %s::jsonb,
                      finished_at = now(),
                      updated_at = now()
                    where id = %s
                    """,
                    (
                        error_message,
                        error_code,
                        error_stage,
                        psycopg.types.json.Jsonb(observability),
                        search_run.id,
                    ),
                )
        log_event(
            logger,
            logging.ERROR,
            "search_run_failed",
            correlation_id=search_run.correlation_id,
            search_run_id=search_run.id,
            provider=search_run.source,
            error_code=error_code,
            error_stage=error_stage,
            error_message=error_message,
        )

    def _find_existing_business(
        self,
        connection: psycopg.Connection[Any],
        business: NormalizedBusiness,
    ) -> tuple[dict[str, Any] | None, str | None]:
        if business.external_id:
            existing = connection.execute(
                """
                select *
                from businesses
                where source = %s and external_id = %s
                limit 1
                """,
                (business.source, business.external_id),
            ).fetchone()
            if existing is not None:
                return existing, "external_id"

        existing = connection.execute(
            """
            select *
            from businesses
            where source = %s
              and regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') = %s
              and regexp_replace(lower(coalesce(address, '')), '[^a-z0-9]+', '', 'g') = %s
            order by created_at asc
            limit 1
            """,
            (
                business.source,
                normalize_dedupe_text(business.name),
                normalize_dedupe_text(business.address),
            ),
        ).fetchone()
        if existing is None:
            return None, None

        return existing, "name_address"

    def _build_merge_payload(
        self,
        existing: dict[str, Any],
        incoming: NormalizedBusiness,
    ) -> dict[str, Any]:
        website = self._prefer_text(existing.get("website"), incoming.website)
        has_website = bool(existing.get("has_website")) or (
            incoming.has_website and website is not None
        )

        return {
            "id": existing["id"],
            "external_id": self._prefer_text(existing.get("external_id"), incoming.external_id),
            "category": self._prefer_text(existing.get("category"), incoming.category),
            "address": self._prefer_text(existing.get("address"), incoming.address),
            "city": self._prefer_text(existing.get("city"), incoming.city),
            "region": self._prefer_text(existing.get("region"), incoming.region),
            "country": self._prefer_text(existing.get("country"), incoming.country),
            "lat": existing.get("lat") if existing.get("lat") is not None else incoming.lat,
            "lng": existing.get("lng") if existing.get("lng") is not None else incoming.lng,
            "phone": self._prefer_text(existing.get("phone"), incoming.phone),
            "website": website,
            "has_website": has_website,
            "maps_url": self._prefer_text(existing.get("maps_url"), incoming.maps_url),
        }

    def _prefer_text(self, existing: Any, incoming: str | None) -> str | None:
        if isinstance(existing, str) and existing.strip():
            return existing
        return incoming

    def _map_search_run(self, row: dict[str, Any]) -> SearchRun:
        return SearchRun(
            id=row["id"],
            query=row["query"],
            location=row["location"],
            source=row["source"],
            correlation_id=row.get("correlation_id"),
            status=row["status"],
            total_found=row["total_found"],
            error_message=row.get("error_message"),
            error_code=row.get("error_code"),
            error_stage=row.get("error_stage"),
            observability=row.get("observability"),
        )
