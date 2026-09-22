# Cross-session taskboard

Tasks in `active/taskboard/` use these states:

```text
TASK-X.Y-pending.md
TASK-X.Y-active.md
TASK-X.Y-done.md
TASK-X.Y-blocked.md
```

Claim a task by atomically renaming pending → active. Modify only its owned files, run its verification, replace the file with a completion report, then rename it done or blocked. Workers never stage or commit.

The chief reads reports and actual diffs, applies shared changes, runs the unified gate, commits coherent features, and archives reviewed tasks with the associated plan. Parallel tasks must have no owned-file overlap or output dependency.
