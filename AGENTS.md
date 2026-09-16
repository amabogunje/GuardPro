# Repository work instructions

## MVP remediation tracking

Before fixing or changing behavior covered by the production-readiness audit, read `docs/MVP-REMEDIATION-PLAN.md`. It is the authoritative issue/status/evidence register. The original audit in `docs/audit-2026-09-16/` remains a historical baseline.

- Map remediation work to its stable G/S/O/X issue IDs; record newly introduced or newly discovered distinct defects with R IDs.
- Update status before starting and record actual acceptance/test/review evidence after changes. Keep these plan updates in the same change set as implementation.
- Do not mark an issue Verified based only on code changes, intended tests, old test results or an unverified assumption. Record outstanding hardware, operational or user decisions explicitly.
- Track deployment separately from implementation verification. Do not report a local fix as deployed.
- Never remove or silently skip issues or failing tests. Record accepted deferrals and scope limits; reopen issues that regress.
- Before ending a remediation task, update the plan's next action, issue evidence and chronological log so another person can resume without relying on conversation history.

For unrelated work, do not invent remediation progress or change issue scope. Follow the user's current instructions if they override this workflow.
