"""Public data-status endpoint (no auth, minimal fields).

Freshness logic lives in ``api.freshness`` so this endpoint and the hourly ops
watchdog (``api.tasks.check_data_freshness``) can never disagree. The payload
now reports real ``age_hours`` / ``is_stale`` per dataset — previously a
dataset was reported ``ready`` whenever a row merely existed, which made
month-old data read as healthy.
"""
from django.http import JsonResponse

from api.freshness import freshness_summary


def data_status_public(request):
    return JsonResponse(freshness_summary())
