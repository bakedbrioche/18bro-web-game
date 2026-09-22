# Git discipline

- One coherent change per commit; include its tests, docs, and changelog entry.
- Use conventional subjects such as `feat:`, `fix:`, `docs:`, `test:`, or `chore:`. Explain the user-visible reason in the body when the subject is not enough.
- Always stage explicit paths. Never use `git add .` or `git add -A`.
- Before committing, inspect `git diff --cached --name-only` and `git diff --cached`.
- Never commit secrets, local environment files, dependency directories, or ignored release output.
- Never commit or push unless the user explicitly asks in the current task. Commit authorization does not imply push, merge, deploy, or publish authorization.
- Subagents and workers do not stage or commit; the chief reviews and integrates their work.
- Avoid force pushes and history rewriting on shared branches.

Commit messages describe the final change, why it exists, and meaningful validation. Do not include abandoned approaches or conversational history.
