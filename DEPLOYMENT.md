# Deployment

This project is packaged as a Docker Compose app:

- `frontend`: Angular production build served by nginx
- `backend`: Django API served by gunicorn
- `worker`: Celery worker for the data update system
- `beat`: Celery Beat scheduler for the daily CSCS update
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
