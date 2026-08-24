# Runbook — Weekly SEC NAV Update (Naija Finance Hub)

Cadence: SEC Nigeria publishes the Weekly Net Asset Value for CIS report each Friday at
https://sec.gov.ng/for-operators/keep-track-of-capital-market-data/net-asset-value-data/weekly-net-asset-value-for-cis/
(latest year page, e.g. `2026-weekly-nav-for-cis/`).

## Automated path

Celery beat runs `run_sec_nav_ingest` daily at 06:30 Lagos time. It imports whatever
NAV CSV is staged for it and logs every attempt to `DataIngestRun` (SUCCESS / SKIPPED /
FAILED). A FAILED run triggers an ops email alert automatically (S5 slice). No CSV
staged → clean SKIPPED row; nothing is invented.

## Manual weekly update (current standard until an API/feed is licensed)

1. Download the newest `Net_Asset_Value_and_Unit_Price_as_at_*.xlsx` from the SEC page above.
2. Convert to import CSV (`fund_name,date,nav`) — Bid Price (N) column is the redemption-side unit NAV:

   ```python
   import openpyxl, csv
   wb = openpyxl.load_workbook('SEC_FILE.xlsx', read_only=True)
   ws = wb['Weekly Valuation']
   with open('/tmp/secnav.csv', 'w', newline='') as fh:
       w = csv.writer(fh); w.writerow(['fund_name','date','nav'])
       for r in ws.iter_rows(values_only=True):
           if isinstance(r[1], str) and r[1].strip():
               w.writerow([r[1].strip(), 'YYYY-MM-DD', r[7]])
   ```

3. Import inside the app container:

   ```bash
   docker compose -p nf-staging exec backend python manage.py ingest_sec_nav --file /tmp/secnav.csv
   # prod equivalent: docker compose exec backend python manage.py ingest_sec_nav --file /tmp/secnav.csv
   ```

4. Verify:

   ```python
   from api.models import NavSnapshot
   from django.db.models import Max, Count
   NavSnapshot.objects.filter(date='YYYY-MM-DD').values('fund').distinct().count()
   NavSnapshot.objects.aggregate(Max('date'))
   ```

## Rules

- Insert-only for a new week; never overwrite existing snapshots blindly — seeded series
  use fund-manager publication values which can differ from SEC bid/offer quotes
  (money-market funds pegged at ₦1/₦100 are the known divergence).
- Funds whose SEC name does not exactly match our registry are reported as skipped by the
  importer (`Fund not found: ...` warnings) — reconcile names rather than force-matching.
- Data honesty: if a source can't be fetched or parsed, log it and leave data as-is;
  never fabricate NAVs.
