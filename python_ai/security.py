"""
python_ai/security.py
Shared-Secret IPC Authentication & Layered Prompt Injection Defenses for Python AI Services.
"""

import hmac
import os
import re
from typing import Optional
from fastapi import Request, HTTPException, status


def get_internal_ipc_secret() -> str:
    """Retrieves the authoritative internal IPC secret for cross-service authorization."""
    secret = os.getenv("INTERNAL_IPC_SECRET") or os.getenv("SESSION_SECRET")
    env = (os.getenv("NODE_ENV") or os.getenv("ENVIRONMENT") or "development").lower()

    if not secret:
        if env in ("production", "staging", "preview"):
            raise RuntimeError(
                "FATAL SECURITY ERROR: INTERNAL_IPC_SECRET or SESSION_SECRET must be explicitly configured in production/staging. Failing closed."
            )
        return "careerforge-internal-ipc-secret-min-32-chars"

    if env in ("production", "staging", "preview") and len(secret) < 32:
        raise RuntimeError(
            "FATAL SECURITY ERROR: Production IPC secret must be at least 32 characters long."
        )

    return secret


async def verify_internal_ipc_request(request: Request) -> bool:
    """
    Enforces shared-secret authorization for internal Python AI endpoints.
    Verifies X-Internal-Secret header using constant-time comparison.
    Enforces maximum payload size bounds (512KB).
    """
    # 1. Enforce payload size limit
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > 524288:  # 512 KB
                raise HTTPException(
                    status_code=413,
                    detail="Payload exceeds maximum safety limit (512KB).",
                )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid Content-Length header.",
            )

    # 2. Check X-Internal-Secret header
    provided_secret = request.headers.get("x-internal-secret") or ""
    expected_secret = get_internal_ipc_secret()

    if not provided_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Missing X-Internal-Secret header for internal IPC endpoint.",
        )

    # Constant-time comparison
    if not hmac.compare_digest(provided_secret.strip(), expected_secret.strip()):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid X-Internal-Secret header.",
        )

    return True


def wrap_untrusted_data(source_name: str, content: str) -> str:
    """
    Wraps external/user data into an isolated data boundary.
    Neutralizes delimiters, control tokens, and system instruction overrides.
    """
    if not content:
        return ""

    sanitized = content

    # Strip dangerous LLM special chat tokens
    forbidden_tokens = [
        r"<\|im_start\|>",
        r"<\|im_end\|>",
        r"<\|system\|>",
        r"<\|assistant\|>",
        r"<\|user\|>",
        r"\[SYSTEM INSTRUCTION:?.*?\]",
        r"\[INST\].*?\[/INST\]",
    ]
    for pattern in forbidden_tokens:
        sanitized = re.sub(pattern, "[REDACTED_CONTROL_TOKEN]", sanitized, flags=re.IGNORECASE)

    # Escape closing tag to prevent boundary breakouts
    sanitized = sanitized.replace("</external_data>", "&lt;/external_data&gt;")

    safe_source = re.sub(r'["\r\n<>]', "", source_name).strip().lower()
    return f'<external_data source="{safe_source}" integrity="untrusted">\n{sanitized}\n</external_data>'
