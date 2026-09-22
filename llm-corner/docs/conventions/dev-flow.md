# Development flow

Every change follows this sequence.

1. **Gate in.** Read the relevant llm-corner docs and run `npm run verify` before code changes. Record any pre-existing failure.
2. **Understand.** Trace the real runtime path and check `docs/reference/gotchas.md` plus recent tagged changelog entries.
3. **Plan.** Work needing multiple commits, a contract change, or a new pattern gets a `PLAN-NNN` in `active/plans/` before implementation.
4. **Isolate.** Use a focused branch for nontrivial collaboration. Declare file ownership before parallel work.
5. **Implement.** Change authoritative files in `dist/`, add meaningful regression coverage for behavior, and update docs with the code.
6. **Verify.** Run `npm run verify`. For UI/rendering/input/audio, run `npm start` and exercise menu → start/skip intro → moving run → pause/resume. Review at representative desktop and mobile sizes when responsive behavior changes.
7. **Review.** Inspect the full diff, run `git diff --check`, scan staged paths for secrets/unrelated files, and ensure generated output was not hand-edited.
8. **Commit.** Use one atomic conventional commit after current-task authorization. Do not push unless separately authorized.
9. **Close.** Update changelog, decisions, plan status, backlog, and handoff per `protocols/lifecycle.md`.

`npm test` is useful during iteration but does not replace `npm run verify`. A passing gate does not replace a real browser check for visible behavior.
