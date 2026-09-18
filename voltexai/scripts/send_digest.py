#!/usr/bin/env python3
"""
Send the VoltexAI weekly digest — cron-friendly, no HTTP / no admin token needed.

Runs the real backend/services/mailing.py path against the configured database and
email provider (SMTP / Resend / console per EMAIL_PROVIDER). Schedule it, e.g. a
Render/GitLab cron every Monday 06:00 UTC:

    cd voltexai && python -m scripts.send_digest

Exits non-zero on error so a scheduler can alert. Delivery still depends on a
configured email provider; with EMAIL_PROVIDER=console it only logs.
"""
import sys


def main() -> int:
    from backend.database import SessionLocal, init_db
    from backend.services import mailing

    init_db()                       # ensure tables exist (idempotent)
    db = SessionLocal()
    try:
        res = mailing.weekly_digest(db)
        print(f"[digest] provider={res.get('provider')} recipients={res.get('recipients')} "
              f"sent={res.get('sent')} failed={res.get('failed')} campaign={res.get('campaign_id')}")
        return 0 if res.get("ok") else 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
