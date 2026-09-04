# Agent Instructions

<!-- compass:start:global -->
# Global Defaults

- Prefer simple, maintainable solutions. Avoid overengineering.
- Prefer the Cloudflare-native stack unless the project says otherwise. Do not silently change stack.
- Make small, understandable changes. Prefer targeted edits over broad rewrites unless asked.
- Do not invent credentials, services, or architecture.
- Be concise, pragmatic, and low-repetition. Explain assumptions briefly.
- Inspect the repo before asking broad setup questions.
- `AGENTS.md` and `CLAUDE.md` are already in your context; never read them again. Read `.compass/ui.md` for UI work, and `PROJECT-NOTES.md` or deploy docs only when the task touches deployment.
- After meaningful code changes, run checks and ship with `compass-ship "message"`. Do not stop at an uncommitted handoff.

## Efficient execution

- Optimize for the shortest safe path to the requested outcome. Do not trade away correctness, security, or required verification.
- For a narrow request, inspect only the relevant files, symbols, and nearby context. Prefer `rg` and narrow line ranges; do not dump large files or repository trees without a concrete need.
- Reuse context already established in the current thread. Do not reread unchanged instructions or files already in context, except where a skill requires a fresh read.
- No tree dumps: no `find .`, `ls -R`, or `tree` below depth 2. Never list or read `node_modules`, `dist`, `out`, `build`, `.wrangler`, coverage, lockfiles, minified or generated files, or packaged binaries.
- Cap command output. Pipe installs, builds, and tests through `tail -30`. Never run watch modes, dev servers, or log tailers in the foreground; anything that can hang gets a timeout.
- No ritual `git status`, `git log`, or `git diff` at session start. Run them only when the task concerns existing changes; `compass-ship` shows the file list before committing.
- For screenshot-led UI work, fix the visible requested issues first. Do not add adjacent features, redesign other areas, or expand scope unless required for the fix.
- Start with the smallest targeted patch. If it fails, inspect the exact surrounding context and retry narrowly instead of broadening the rewrite.
- Never run a repository-wide formatter for a targeted change or against a pre-existing unformatted file. Format only touched code, then check the diff size.
- Batch independent reads and checks into one tool call when practical.
- Avoid duplicate verification. Know what `compass-ship` already runs; during implementation use only the fastest targeted check, then let the wrapper run the full suite once.
- Decide reversible choices yourself and state the assumption in one line. Ask at most one clarifying question, and only when the readings lead to materially different work.
- Final message under 150 words for ordinary tasks: what changed, what was verified, what is left. Do not restate the diff. Write a `plans/` file only for work spanning sessions.
- Stop when the requested result is implemented, checks pass, and it is shipped. Do not add optional audits, deployment polling, or status checks.

## Load a skill instead of carrying the knowledge

Long knowledge lives in skills, not in this file. Load the skill when the task calls for it:

- `compass-ui` — any interface work, before touching a component.
- `compass-workflow` — deploys, migrations, "is it live", and the plain-text summary to send a client after a fix.
- `compass-mcp` — anything involving MCP servers or app connectors.
- `simple-app-auth` — email allowlist, one-time setup codes, email-plus-password login.

Anything over roughly 2 KB that applies to fewer than half the repos belongs in a skill, not in an always-loaded memory file. If you find yourself adding a long section here, add a skill instead.

## Finish the whole job — never leave manual steps for the user

The owner is not a technical user and must never be handed terminal commands, migrations, or deploy steps to run. Whatever a change needs to reach production, the agent runs it, verifies it, and only then reports done.

- Run database migrations yourself immediately after adding migration files. A git-push deploy never applies them.
- In a git-connected auto-deploy repo, a successful push completes the deployment. Do not poll deployment lists, CI, or Cloudflare status to prove it landed.
- Call live URLs only when the change altered URL or API behaviour and an HTTP test gives real evidence, or when the owner asks.
- When the Project section says "Unknown" for something you just worked out (deploy style, build command, database, worker name), write the real value into both the repo's `AGENTS.md` and `~/CompassAgentMemory/projects/<repo-name>.md` in the same turn.
- Details, including deploy styles and what counts as verification, are in the `compass-workflow` skill.

## Client-reported changes

When the owner relays client feedback, ship the fix and then, without being asked, output a plain-text summary they can paste into an email: no markdown, one sentence per item, no technical terms, in its own clearly separated block. The full rules are in `compass-workflow`, reference `client-email.md`.

## Shipping — one command, one approval

The only approved way to commit is:

```
/Users/macpro/CompassAgentMemory/bin/compass-ship "commit message" [file ...]
```

It stages, refuses to proceed if a staged file looks like a secret, runs the project check, commits, and pushes as a single tool call, so it costs one approval instead of three. With no file list it stages everything.

Do not run `git add`, `git commit`, or `git push` separately. They still work and still prompt; they are just three interruptions instead of one. Force-push and `reset --hard` are denied outright.

## No browser or visual testing

Never launch a browser, headless browser, screenshot tool, or visual-regression run. These are denied at the policy layer; the attempt will fail and cost you a turn.

The owner supplies screenshots when a visual check is needed. Verify with typecheck, build, lint, unit tests, and `curl` against the preview or live URL. If you genuinely believe a visual check is required, say so and stop.

Close what you start. A `vite` or `wrangler dev` spawned to verify something must be stopped in the same turn.

## Subagents

Do not spawn subagents unless the user asks for one in that message. They re-derive context from cold and cost many times a normal turn. Handle multi-part work inline.

## Escalation is normal — do not let it stop you

These cost one approval each, and you should go ahead and ask: applying a D1 migration, any non-SELECT `wrangler d1 execute`, `wrangler deploy` or `pages deploy`, `wrangler secret`, R2 object writes, KV key writes.

This does not weaken "Finish the whole job". Ask, get the approval, run it, verify it, then report done. What you must not do is skip the step or hand it to the owner.

DNS and zone settings are the exception: denied with no escalation path. If a DNS change is needed, say so and let the owner make it in the Cloudflare dashboard.

## Where these rules are enforced

Prose is advice, and a model under pressure can talk itself past advice. The rules above that matter are also compiled into `permissions.deny` / `permissions.ask` and a `PreToolUse` hook, from `~/CompassAgentMemory/memory/60-policy.json`. Where this file says something is denied, it is denied by the harness, not by good intentions.
<!-- compass:end:global -->

<!-- compass:start:security -->
# Security Rules

- Never read, print, export, reveal, or exfiltrate secrets.
- Never ask the user to paste Cloudflare API tokens or secrets into chat.
- Never commit `.env`, `.dev.vars`, private keys, API tokens, database passwords, wallet files, or Wrangler auth files.
- Never run commands that intentionally dump environment variables or secrets.
- Prefer existing local authenticated sessions.
- If a secret is needed, instruct the user to set it manually using the project's documented safe command.
- Before commit, check for accidental secrets.
- If unsure whether a file contains secrets, do not display it fully.
- Do not expose wallet files, DB connection secrets, Cloudflare credentials, or Wrangler auth files.
<!-- compass:end:security -->

<!-- compass:start:ui -->
# Interface Quality Defaults

Apply these rules to frontend work. Taste is installed once as tokens and reused; it is never hand-painted per file.

- Read `.compass/ui.md` first. If it is missing, load the `compass-ui` skill and create it from `references/ui-profile-template.md` before the first UI change: classify the product, record the foundation, define the tokens. Then build with it.
- Classify the interface as institutional, product, or expressive. The class decides canvas warmth, density, motion, and how rich navigation may be. A clinical data screen does not get marketing-site treatment.
- Reuse the project's components and semantic tokens (`background`, `surface`, `foreground`, `muted`, `border`, `accent`). Raw palette classes in feature code (`bg-white`, `text-slate-600`, `border-gray-200`) are a defect: use or add a token.
- Colour: an off-white or warm-grey canvas, near-black text, one neutral family, and exactly one accent reserved for the primary action, focus rings, active states, and status marks. Pure `#fff` under `#000` is a deliberate expressive choice, never a default.
- Structure with hairline low-contrast borders and surface tone, not shadows. Shadows belong to floating layers only (popover, menu, dialog): two or three stacked low-alpha layers plus a hairline border.
- Navigation: tabs and segmented controls are pill containers with a soft filled active state unless the product already has a settled tab style. A menu with five or more destinations becomes a structured panel with icon, label, one-line description, and small tracked group labels. Smaller menus stay a plain list.
- Type: one family, a strict scale, tighter tracking on large headings, tabular numerals for tables and money, secondary text in the muted token rather than a lighter weight.
- Do not use inline CSS or React `style={{...}}` for forms and controls.
- Put short create/edit CRUD forms in an accessible centred modal. Keep login, search, filters, and long or multi-step workflows on a page.
- In React, default to shadcn/ui primitives (Radix underneath) for behaviour-heavy controls; use React Aria Components only where the project already uses them or shadcn has no primitive. In Astro, use Tailwind with shared components; Starwind is an acceptable starting layer. Never hand-roll modal focus management, date pickers, comboboxes, listboxes, menus, or select-like keyboard behaviour.
- Controls are about 44px high with persistent labels, useful help and error text, and widths that match the expected answer. Search has a clear button.
- Motion: opacity and transform, 150–220ms, ease-out in, slightly faster out, `prefers-reduced-motion` honoured. No `transition-all`, no scale-from-zero, no decorative motion.
- Load the `compass-ui` skill for any UI task; its `references/taste.md` holds the composition rules that separate correct from good.
- Improve the real interface directly; no preview concepts or variants. Run the Compass interface audit after meaningful UI work and fix regressions before shipping.
<!-- compass:end:ui -->

<!-- compass:start:stack -->
# Cloudflare Defaults

- Prefer Cloudflare Pages, Workers, D1, and R2 when suitable.
- Inspect existing `wrangler.toml`, `wrangler.json`, `wrangler.jsonc`, `package.json`, and deployment scripts before changing anything.
- Prefer GitHub push auto-deploy if configured. Confirm whether the repo is a GitHub-linked Pages project, a Worker project, or both before changing deployment flow. If a repo also includes a separate Worker, keep that deploy path separate from the Pages site.
- Do not create new Cloudflare resources, change production bindings, or rotate secrets unless explicitly asked.
- Prefer the documented project scripts: `npm run build`, `npm run deploy`, `npm run cf:deploy`, `npm run agent:check`.
- One machine here is macOS 12.6, so do not depend on `wrangler dev --local`. Prefer `wrangler dev --remote` when runtime validation is needed. If remote validation is blocked, use build, lint, tests, and config inspection rather than blaming the app.
- For Astro UI work, prefer Starwind UI first; use `shadcn/ui` where Starwind lacks the component or gives a clearly worse result.
- For simple app authentication, load the `simple-app-auth` skill. Workers Web Crypto PBKDF2 rejects iteration counts above 100,000.
- For deploy specifics, migrations, and the "is it live" question, load the `compass-workflow` skill.


# Mobile / PWA layout rules

## Before designing a fix
- `~/Dev/Apps/Quick Prescribe` (`frontend/src/styles/main.css`, `frontend/src/main.js`) is the most-iterated mobile/PWA layout in the portfolio. For any iOS safe-area, viewport-height or bottom-nav problem, read it first and reuse its approach and its reasoning comments. Do not re-derive a solution that already exists there.

## Sizing a full-screen installed shell
- An installed iOS PWA can report a **dynamic viewport shorter than the real screen**, and it stays short until the app is force-closed. Anything derived from it leaves a bottom bar floating above the screen edge with a dead band underneath.
- These all inherit that short value and will all fail the same way: `100dvh`/`h-dvh`; `position: fixed` + `inset: 0`; a `height: 100%` chain on `html`/`body`/`#root`.
- **Use `100lvh`** (the large viewport = the true screen). It is static, so it cannot come up short or go stale on resume.
- Apply it **only to the installed shell**. In a mobile browser the large viewport is taller than the visible area, which hides the bottom bar behind the address bar. Set the flag inline in `<head>` before the stylesheet so first paint is already correct:
  ```html
  <script>
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      document.documentElement.classList.add('standalone-app');
    }
  </script>
  ```
  ```css
  html.standalone-app, html.standalone-app body, html.standalone-app #root { height: 100lvh; }
  ```

## Bottom bars and safe areas
- Define safe-area padding **once** as a CSS custom property and reference it everywhere. Several files each hardcoding their own guess at bottom-bar height is what makes this bug recur.
- Prefer an in-flow flex child for a bottom bar over `position: fixed`; then pages need no compensating bottom padding at all.
- `viewport-fit=cover` plus `apple-mobile-web-app-status-bar-style: black-translucent` is the combination that lets the app tint the status-bar area instead of leaving a gap.
<!-- compass:end:stack -->

<!-- compass:start:project -->
# Project: doctor_direct

## Basic Info

Path: /Users/macpro/Dev/Apps/doctor_direct
Detected stack: cloudflare, astro
Main app type: Astro site
Deploy style: Cloudflare Worker — wrangler deploy, or Workers Builds if the dashboard has git integration (confirm once, then record it here)
Git branch: main
Deploy trigger: Unknown (options: push-to-main auto-deploys via Cloudflare git integration / manual wrangler deploy / other)

## Agent Rules

- Read AGENTS.md first.
- Follow global and security rules.
- Use project-specific commands below.

## Project Commands

Build: npm run build
Test: Unknown
Check: Unknown
Deploy: npm run deploy
Commit/push policy: commit and push meaningful changes to the current branch after checks pass unless the user explicitly says not to

## Interface Profile

UI personality: Unknown (choose institutional / product / expressive)
Component foundation: Tailwind shared Astro components (Starwind acceptable)
Form pattern: short create/edit flows in accessible modals; login, search, filters and long workflows stay dedicated
Motion profile: restrained, purposeful, 150–220ms, reduced-motion supported; no preview variants

## Cloudflare Notes

Wrangler config: wrangler.toml
D1 bindings: medconnect-db
R2 bindings: medconnect-files
Pages project: Unknown
Worker name: medconnect

## Database Notes

Database type: Cloudflare D1
Migration style: Unknown
Migrations: Unknown (options: manual — agent must run them / automatic / none)
Backup notes: Unknown

## Manual Notes

Add human notes here.
<!-- compass:end:project -->

<!-- compass:start:workflows -->
# Workflows

## Standard Agent Workflow

1. `AGENTS.md` and `CLAUDE.md` are already in your context. Do not read them again. Read `.compass/ui.md` only for UI work and `PROJECT-NOTES.md` or deploy docs only when the task touches deployment.
2. Inspect only the files the request names and their direct neighbours.
3. Make the smallest correct change.
4. Run one targeted check at the end (typecheck or build), output tailed.
5. Ship with `compass-ship "message"`; it stages, scans for secrets, runs the project check, commits, and pushes in one approval. Never stage, commit, or push by hand.
6. Report in under 150 words: what changed, what was verified, what is left.

## Standard Safety Workflow

- Never print, read whole, or commit `.env`, `.dev.vars`, tokens, keys, or wallet files. `compass-ship` refuses secret-like files; do not work around it.
<!-- compass:end:workflows -->
