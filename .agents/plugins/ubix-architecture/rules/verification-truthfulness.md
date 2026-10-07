# UBIX Architecture Governance: Truthfulness & Browser Verification

## 1. Absolute Truthfulness & Zero Mock Data

To protect user trust, UBIX strictly prohibits synthetic, fabricated, or deceptive data in user-facing experiences:

- **No Fabricated Answers**: Never insert hardcoded fallback answers or pretend an audio recording succeeded.
- **No Fabricated Achievements**: Never populate empty dashboards with simulated milestones, fake evidence, or artificial practice scores.
- **No Fabricated Salaries / Job Outcomes**: Disclaim all algorithmic projections clearly as scenario estimates, not guarantees.
- **No Dummy Buttons**: Never introduce inert controls like `onClick={() => {}}` or buttons that simulate nonexistent functionality. If a provider is not configured, display a clear, accessible notice explaining the requirement.
- **Truthful Empty States**: When data is absent, display a clear empty state (e.g., *"No skill evidence has been added yet."*).

## 2. Browser Verification Protocol

Unit tests and successful compilation are necessary, but insufficient to declare a feature complete.

Before marking a user-facing capability finished:
1. Verify initial page load and layout in a real browser.
2. Verify discovery and keyboard/mouse interaction on the actual UI control.
3. Verify the network request/response lifecycle.
4. Verify dynamic UI updates and screen-reader announcements.
5. Verify page reload preserves persisted database records.
6. Verify multi-tenant isolation with two distinct user sessions.

### Verification Status Labels:
Use only explicit, evidence-backed labels:
- `UNIT TEST VERIFIED`
- `INTEGRATION VERIFIED`
- `BROWSER VERIFIED`
- `PERSISTENCE VERIFIED`
- `TENANT ISOLATION VERIFIED`
