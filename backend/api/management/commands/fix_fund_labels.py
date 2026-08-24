"""
Fund asset-class label cleanup (data-quality debt, flagged 2026-08-14).

Fixes three classes of mislabels in the Fund table:
1. Money-market funds stored as EQUITY (name-based classification).
2. Stray enum value 'FIXED' -> FIXED_INCOME or BOND-style fixed income.
3. Stray enum value 'MONEY' -> MONEY_MARKET.

Usage:
    python manage.py fix_fund_labels            # dry run: print planned changes
    python manage.py fix_fund_labels --apply    # apply changes
"""
import re
from django.core.management.base import BaseCommand
from api.models import Fund

MM_PATTERNS = [
    r"\bmoney\s*market\b",
    r"\bmmf\b",
    r"\bcash\s*management\b",
    r"\btreasury\s*bills?\b",
]
FI_PATTERNS = [
    r"\bfixed\s*income\b",
    r"\bbond\b",
    r"\btreasury\b",
    r"\bdebt\b",
]


def classify(name: str):
    n = name.lower()
    if any(re.search(p, n) for p in MM_PATTERNS):
        return "MONEY_MARKET"
    if any(re.search(p, n) for p in FI_PATTERNS):
        return "FIXED_INCOME"
    return None


class Command(BaseCommand):
    help = "Reclassify mislabeled fund asset_class values (dry run unless --apply)"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write changes")

    def handle(self, *args, **opts):
        changes = []
        for f in Fund.objects.all():
            new = None
            if f.asset_class not in {c for c, _ in Fund.ASSET_CLASSES}:
                # stray enum values first
                if f.asset_class == "MONEY":
                    new = classify(f.name) or "MONEY_MARKET"
                elif f.asset_class == "FIXED":
                    new = classify(f.name) or "FIXED_INCOME"
            if new is None and f.asset_class == "EQUITY":
                new = classify(f.name)
                if new == "EQUITY":
                    new = None  # never 'fix' EQUITY into EQUITY
            if new and new != f.asset_class:
                changes.append((f.id, f.name, f.asset_class, new))

        self.stdout.write(f"{len(changes)} funds to relabel:")
        for fid, name, old, new in changes:
            self.stdout.write(f"  [{fid}] {name}: {old} -> {new}")

        if opts["apply"]:
            for fid, _, _, new in changes:
                Fund.objects.filter(id=fid).update(asset_class=new)
            self.stdout.write(self.style.SUCCESS(f"Applied {len(changes)} updates."))
        else:
            self.stdout.write("Dry run only. Re-run with --apply to write changes.")
