"""SMTP email sender for 6-digit account verification & password reset codes."""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .config import settings

log = logging.getLogger("gymbuddy.email")


def _build_html(code: str, purpose: str) -> tuple[str, str, str]:
    title = "Verify your GymBuddy account" if purpose == "verify" else "Reset your GymBuddy password"
    intro = (
        "Welcome to GymBuddy! Enter the 6-digit verification code below to confirm your email:"
        if purpose == "verify"
        else "We received a password reset request. Enter the 6-digit code below (valid for 15 minutes):"
    )
    html = f"""
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F3F7F2;padding:24px;">
      <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:24px;overflow:hidden;border:1px solid rgba(13,25,18,0.08);">
        <div style="background:#08130D;padding:22px 26px;color:#FFFFFF;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#DAF85A;">GYMBUDDY AI</div>
          <h1 style="margin:6px 0 0;font-size:20px;color:#FFFFFF;">{title}</h1>
        </div>
        <div style="padding:24px 26px;color:#0D1912;font-size:14px;line-height:1.6;">
          <p style="margin-top:0;">{intro}</p>
          <div style="margin:20px 0;padding:16px;border-radius:16px;background:#0C3A22;color:#DAF85A;font-family:monospace;font-size:28px;font-weight:800;letter-spacing:0.25em;text-align:center;">
            {code}
          </div>
          <p style="font-size:12px;color:#6B7D71;margin-bottom:0;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>
    </div>
    """
    return title, intro, html


def _send_brevo(to_email: str, code: str, purpose: str) -> bool:
    import httpx

    title, intro, html = _build_html(code, purpose)
    sender_email = settings.smtp_from or settings.smtp_user
    if not sender_email:
        return False
    try:
        r = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.brevo_api_key, "accept": "application/json", "content-type": "application/json"},
            json={
                "sender": {"name": "GymBuddy AI", "email": sender_email},
                "to": [{"email": to_email}],
                "subject": f"[GymBuddy] {code} — {title}",
                "htmlContent": html,
                "textContent": f"{intro}\n\nCode: {code}\n",
            },
            timeout=15,
        )
        ok = r.status_code < 300
        if not ok:
            log.warning("Brevo send failed %s: %s", r.status_code, r.text[:200])
        return ok
    except Exception as e:
        log.warning("Brevo error: %s", e)
        return False


def _send_resend(to_email: str, code: str, purpose: str) -> bool:
    import httpx

    title, intro, html = _build_html(code, purpose)
    sender = settings.smtp_from or "GymBuddy <onboarding@resend.dev>"
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={
                "from": sender,
                "to": [to_email],
                "subject": f"[GymBuddy] {code} — {title}",
                "html": html,
                "text": f"{intro}\n\nCode: {code}\n",
            },
            timeout=15,
        )
        ok = r.status_code < 300
        if not ok:
            log.warning("Resend send failed %s: %s", r.status_code, r.text[:200])
        return ok
    except Exception as e:
        log.warning("Resend error: %s", e)
        return False


def send_verification_code(to_email: str, code: str, purpose: str = "verify") -> bool:
    """Send a branded 6-digit code. Tries Brevo API, then Resend API, then Gmail SMTP. Returns True if sent."""
    if settings.brevo_api_key and _send_brevo(to_email, code, purpose):
        return True
    if settings.resend_api_key and _send_resend(to_email, code, purpose):
        return True
    if not settings.smtp_user or not settings.smtp_password:
        log.info("No email provider configured; code for %s (%s) not emailed.", to_email, purpose)
        return False

    sender = settings.smtp_from or settings.smtp_user
    title, intro, html = _build_html(code, purpose)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[GymBuddy] {code} — {title}"
    msg["From"] = sender
    msg["To"] = to_email
    msg.attach(MIMEText(f"{intro}\n\nCode: {code}\n", "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(sender, [to_email], msg.as_string())
        log.info("Verification email (%s) sent to %s", purpose, to_email)
        return True
    except Exception as e:
        log.warning("SMTP send failed for %s: %s", to_email, e)
        return False
