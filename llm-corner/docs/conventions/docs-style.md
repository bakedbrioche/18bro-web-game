# Documentation style

1. Route by content type, never author. Shared facts belong in the global tree; agent folders contain only role-specific material.
2. Every fact has one canonical file. Other files link to it.
3. Location follows lifecycle: `docs/` is evergreen, `active/` is temporary, `history/` is append-only.
4. Keep one topic per file and route to it within two hops from `llm-corner/README.md`.
5. Use lowercase kebab-case for evergreen docs, `PLAN-NNN-<slug>.md` for plans, `DEC-NNN-<slug>.md` for decisions, and `YYYY-MM-DD-<slug>.md` for dated history.
6. Evergreen docs state current truth. Completed work belongs in changelog/handoffs; rationale belongs in decisions.
7. Prefer short code pointers over copied implementation detail. Fix drift immediately when docs and code disagree.
