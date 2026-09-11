# Deployment

This project is packaged as a Docker Compose app:

- `frontend`: Angular production build served by nginx
- `backend`: Django API served by gunicorn
- `worker`: Celery worker for the data update system (starts by default)
- `beat`: Celery Beat scheduler — daily SEC NAV ingest + hourly freshness watchdog
- `redis`: Celery broker/result backend

## Local Docker Run

Copy the example env file and fill in production values:

```sh
cp .env.example .env
```

Then run:

```sh
docker compose up -d --build
```

The app is served on `http://localhost:4200` by default. Change `FRONTEND_PORT` in `.env` if another port is needed.

## GitHub Actions Deploy

The workflow in `.github/workflows/deploy.yml` expects a self-hosted Mac Mini runner with Colima and Docker Compose installed.

Add a repository secret named `PRODUCTION_ENV` with values like:

```env
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.example
DJANGO_CORS_ALLOWED_ORIGINS=http://your-domain.example
DJANGO_CSRF_TRUSTED_ORIGINS=http://your-domain.example
FRONTEND_PORT=4200
CSCS_USERNAME=
CSCS_PASSWORD=
CSCS_TARGET_URL=https://your-cscs-price-history-url.example
CSCS_DAILY_UPDATE_ENABLED=True
CSCS_DAILY_UPDATE_HOUR=18
CSCS_DAILY_UPDATE_MINUTE=30
CSCS_ACTIVE_JOB_STALE_HOURS=20
CSCS_HEADLESS=True
CELERY_TIMEZONE=Africa/Lagos
```

The daily update is scheduled in `Africa/Lagos` time by default. With the example above, Celery Beat queues the CSCS update every day at `18:30`.
If `CSCS_TARGET_URL` is blank, the scheduler falls back to the most recent previous CSCS scrape URL in the database; set it explicitly for first-time production deployments.

On push to `main`, the workflow pulls the repository into `/Users/kalu/finance-app` and runs:

```sh
docker compose up -d --build
```

## Sprint 1 Free Data Layer (branch: feat/sprint1-free-data-layer)

New public data endpoints (all read-only, `is_active` only, no auth):

| Feature | Endpoint | Model |
|---|---|---|
| F-04 Bonds & DMO auctions | `/api/bonds/`, `/api/auctions/` | `Instrument` (BOND), `AuctionCalendar` |
| F-05 Funds & NAVs | `/api/funds/` | `Fund`, `NavSnapshot` |
| F-06 CBN FX rates | `/api/fx-rates/?latest=1` | `FxRate` |
| F-07 Company profiles | `/api/companies/` | `CompanyProfile` |
| F-08 Alerts (JWT user-scoped) | `/api/alerts/` | `Alert` |

Ops commands:

```sh
python manage.py migrate
python manage.py seed_public_data      # idempotent seed from public DMO/CBN/fund/company info
python manage.py run_alert_eval        # sets triggered flag on active alerts (no notifications yet)
```

### G3 compliance (2026-08-03)

Login-based CSCS scraping is **retired**. The beat schedule entry was removed,
the scraper tasks are inert unless `CSCS_SCRAPER_ENABLED=true` is explicitly
set (default off), and `trigger_scrape` rejects `cscs.ng` URLs (HTTP 403).
Google Finance public parse and the free data layer remain active.
Do not reintroduce the CSCS login path.

Frontend: minimal Angular demo app under `frontend/naija-finance/` with one
page per feature and "not investment advice" disclaimers.

### S1: daily SEC NAV ingestion (2026-08-23)

Celery Beat schedules `api.tasks.run_sec_nav_ingest` daily (default 06:30
`CELERY_TIMEZONE`, i.e. Africa/Lagos). Every attempt is logged as a
`DataIngestRun` row (status, timestamps, row count — visible in Django admin).
On failure the run is marked FAILED and ops are alerted via the admin-email
path when Django `ADMINS` is configured (email delivery out of scope; the
run row is the system of record). The user-scoped threshold `Alert` model is
deliberately not used for pipeline failures (it requires an owner FK).

Env vars:

```env
SEC_NAV_DAILY_INGEST_ENABLED=True   # default True
SEC_NAV_DAILY_UPDATE_HOUR=6         # beat schedule hour (CELERY_TIMEZONE)
SEC_NAV_DAILY_UPDATE_MINUTE=30      # beat schedule minute
SEC_NAV_CSV_PATH=/app/data/nav_data.csv   # unset -> runs log SKIPPED
SEC_NAV_RUN_STALE_HOURS=2           # overlap guard window
```

With `SEC_NAV_CSV_PATH` set, the task imports that CSV via the existing
`ingest_sec_nav` command (`fund_name,date,nav`). A missing/unreadable file or
malformed rows fail the run and raise the alert; an unconfigured path only
logs a SKIPPED run. Dev API base is
`http://localhost:8000/api` (CORS enabled for `localhost:4200`).

### P0: data freshness watchdog (2026-09-10)

Production data went ~2-5 weeks stale with no signal because (a) `worker` and
`beat` were gated behind the `legacy-celery` compose profile — plain
`docker compose up -d` never started them — and (b) `/api/data-status-public/`
reported `ready: true` for any row that merely existed. Both are fixed:

- **Scheduler is on by default.** `worker` and `beat` no longer carry a compose
  profile, so `docker compose up -d` starts them. Verify with
  `docker compose ps` and by checking that `DataIngestRun` rows accumulate.
- **Honest freshness.** `/api/data-status-public/` now returns per-dataset
  `age_hours`, `stale_after_hours`, `is_stale`, a `stale_datasets` rollup and a
  `watchdog` heartbeat, all from the single source of truth `api/freshness.py`.
- **Hourly watchdog.** `api.tasks.check_data_freshness` (beat: `:15` past the
  hour) records a `DataIngestRun(source='FRESHNESS')` every run and emails
  `ALERT_OPS_EMAIL` once per staleness episode (re-armed on recovery).

Env vars:

```env
DATA_FRESHNESS_WATCHDOG_ENABLED=True   # default True
DATA_FRESHNESS_CHECK_MINUTE=15         # minute past each hour
```

Stale thresholds are cadence-based (`max(cadence * 2, 6h)`) with a dedicated
30-day window for DMO auctions (a past auction is legitimately weeks old).

Note: market indexes (NGX) and CBN FX have **no automated ingestion path** —
they are populated by the one-off `seed_mock_market_data` / `seed_public_data`
commands. The watchdog will accurately report them as stale until a licensed
feed or a scheduled ingest job is added.
