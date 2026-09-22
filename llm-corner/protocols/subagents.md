# Subagent protocol

Use a subagent only when a unit is independent, large enough to justify briefing, and has zero file-ownership overlap with other active units. Read-only research can run while the chief implements.

Before dispatch, declare:

- goal and definition of done;
- owned files, read-only files, and forbidden files;
- relevant project docs and contracts;
- exact verification and report shape.

Subagents never stage, commit, push, deploy, or publish. The chief reads the actual diff or evidence, applies shared-file changes, runs the unified gate, and exercises the real flow. Reports are claims; current files and verification are proof.

If two units need the same file or one needs another’s output, run them sequentially. If a subagent leaves its owned scope, discard those hunks and tighten the next brief.
