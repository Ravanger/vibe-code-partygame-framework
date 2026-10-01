# Library Documentation & Agent Rules

This directory contains up-to-date documentation for key libraries used in this project.

## Agent Rule: Documentation Maintenance
Whenever an implementation task involves a library not yet documented here or introduces a significant change in usage of a documented library, the agent MUST:
1. Fetch/Update the information for that library.
2. Update the corresponding markdown file in `.AGENTS/docs/`.
3. Summarize key functions and concepts relevant to our project's usage.
4. Reference this file in implementation plans.

## Documented Libraries
See `libraries/` (one file per library or library family) and the version table in the root `AGENTS.md`.
Policy: `LIBRARY_DOCS_POLICY.md`; template: `TEMPLATE.md`. Keep each doc under about 150 lines and limited to APIs this repo uses.
