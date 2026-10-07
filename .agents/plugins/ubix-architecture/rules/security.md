# UBIX Architecture Governance: Security Requirements

## 1. Protected Security Infrastructure

Never weaken, bypass, or replace existing security utilities without demonstrating mathematically equivalent or stronger protection.

Protected subsystems include:
- **Session Tokens**: Cryptographically signed HMAC sessions (`cf_session`), Scrypt salted hashing.
- **Tenant Isolation**: Strict cross-tenant boundaries enforced in RLS, APIs, and telemetry.
- **Input Sanitization**: Navigation sanitization, path traversal neutralization, prompt injection wrapping.
- **Rate Limiting**: Tiered IP and user sliding-window rate limiting failing closed in production.
- **File Validation**: Magic byte verification, DOCX ZIP decompression inspection, 15-page limits, 64KB text bounds.
- **Automation Action Policies**: `SAFE_AUTOMATIC`, `CONFIRMATION_REQUIRED`, `EXPLICIT_HUMAN_ACTION`.
- **Confirmation Mechanism**: Single-use server-issued cryptographic tokens.

## 2. Hard Security Invariants

1. **Zero Service-Role Leaks**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser bundles.
2. **Zero Plaintext Credentials in Logs**: Never log passwords, tokens, API keys, or raw auth bodies.
3. **Audio Safety**: Never speak or read passwords, tokens, or credentials aloud in voice synthesis.
4. **No Automated Submission**: External job applications and destructive deletions must always require explicit user review and confirmation.
5. **Change Protocol**: Before touching any security-sensitive file:
   `INSPECT → REVIEW → CHANGE → TEST`
