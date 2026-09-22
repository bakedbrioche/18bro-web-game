# Agent entry point

Project knowledge and workflow live in `llm-corner/`. Start every session with `llm-corner/README.md` and follow its boot sequence before changing code.

Hard rules:

- Treat `dist/` as editable source and the standalone HTML as a generated release artifact.
- Run `npm run verify` before every commit. For UI or rendering changes, also exercise the real flow in a browser.
- Keep keyboard and touch controls, save compatibility, and the DOM-free simulation contracts intact.
- Never commit secrets, generated `release/` output, or unrelated files.
- Do not commit or push unless the user explicitly asks in the current task. Never push, deploy, or publish without explicit authorization.
- Subagents and parallel workers never commit. The chief agent reviews their actual diffs and performs integration.
- Record significant choices in `llm-corner/decisions/`; keep current facts in `llm-corner/docs/`; move completed work to `llm-corner/history/`.

Routing, ownership, validation, and closeout details: `llm-corner/README.md`.
