"""Shared branded HTML email helpers (corporate identity rollout 2026-08-25).

All outgoing product emails should render through branded_html() so every
message carries the NaijaFinance Hub mark and footer. The logo is loaded
from the hosted frontend so it renders without attachments across clients.
"""
import logging
import os

from django.conf import settings

logger = logging.getLogger(__name__)

BRAND_NAME = "NaijaFinance Hub"
BRAND_TAGLINE = "Nigerian Markets, One Dashboard"
# Hosted logo used by all branded emails. Override via env if the asset path moves.
BRAND_LOGO_URL = os.getenv(
    "BRAND_LOGO_URL",
    getattr(settings, "BRAND_LOGO_URL", "https://naijafinancehub.com/icons/icon-512.png?v=3"),
)


def branded_html(title: str, body_html: str) -> str:
    """Wrap email content in the standard branded shell."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
  <tr><td style="background:#0D7C3E;padding:24px 32px;text-align:center">
    <img src="{BRAND_LOGO_URL}" alt="{BRAND_NAME}" width="48" height="48" style="display:inline-block;border-radius:12px;background:#ffffff;padding:4px">
    <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:12px 0 0;letter-spacing:-0.3px">{BRAND_NAME}</h1>
  </td></tr>
  <tr><td style="padding:32px">
    <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;font-weight:600">{title}</p>
    <div style="font-size:14px;color:#333;line-height:1.6">{body_html}</div>
  </td></tr>
  <tr><td style="background:#f8f9fa;padding:20px 32px;border-top:1px solid #eee">
    <p style="margin:0;font-size:11px;color:#999;text-align:center">{BRAND_NAME} — {BRAND_TAGLINE}<br>&copy; 2026 {BRAND_NAME}. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table></body></html>"""
