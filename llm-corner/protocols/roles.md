# Roles

## Chief

The user-facing agent owns the active plan, architecture decisions, shared files, integration, verification, documentation, and commits. Exactly one chief owns a workstream.

## Worker

A separate implementing session claims one task from `active/taskboard/`, modifies only declared owned files, runs the requested gate, reports results, and stops. Workers never stage or commit.

## Auditor

An independent reviewer reopens current files and verifies claims. Findings include severity, file/line evidence, impact, remediation, and verification status. Auditors do not expand implementation scope unless the user asks.

Role is independent of model. One session commonly combines chief and worker; quality responsibilities still apply.
