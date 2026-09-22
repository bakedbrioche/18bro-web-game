# Audit protocol

Audits are evidence-first reviews. Scope the commit range or feature and the surfaces to pressure. Reinspect current files and rerun relevant verification rather than trusting summaries.

Each finding contains:

**Severity · file:line evidence · impact · remediation · verification status**

- Critical: release-blocking corruption, security issue, or unusable core flow.
- High: broken control, major gameplay regression, data-loss/save failure, or release path failure.
- Medium: bounded defect, performance/accessibility gap, or defect-prone design.
- Low: polish, cleanup, or minor documentation drift.

Formal reports go to `history/audits/`. Every unresolved Medium+ finding must be fixed or entered in `active/backlog.md`. Audit findings do not authorize unrelated cleanup.
