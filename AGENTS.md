# Agent Instructions

<!-- compass:start:global -->
# Global Defaults

The owner is not a technical user. Finish the whole job yourself (code, checks, migrations, shipping) and report in plain language. Never hand the owner a terminal command, migration, or deploy step.

## Working

- Keep changes small and match the surrounding code. Do not change the stack (Cloudflare-native unless the project says otherwise) or invent credentials, services, or architecture.
- Find code from the literal in the request (UI text, route, field, error message) with `rg`, after checking the Feature Map in the Project section. Never list or read `node_modules`, `dist`, `build`, `.wrangler`, coverage, lockfiles, or minified files.
- Decide reversible choices yourself and state the assumption in one line. Ask at most one question, and only when the answers lead to different work.
- For a screenshot-led UI fix, fix what is shown; do not redesign neighbouring areas.
- Pipe installs, builds, and tests through `tail -40`. Run dev servers and watchers only in the background and stop them before you finish. macOS has no `timeout` command.
- Never run a repo-wide formatter for a targeted change.
- Scratch files go in `.agent-tmp/`; delete the ones you made. Do not delete files you did not create; mention them instead.
- Work that spans sessions gets a `plans/YYYY-MM-DD-topic.md` file, kept current.

## Hard limits

These are enforced by hooks and permissions. A "Compass guard" refusal is policy; do not work around it.

- No browser, headless browser, screenshot, or visual-regression tools on this machine. The owner supplies screenshots; verify with typecheck, build, tests, and `curl`.
- No DNS or zone changes. Tell the owner what to change in the Cloudflare dashboard.
- Cloudflare writes (deploys, migrations, non-SELECT D1, secrets, R2 and KV writes) prompt once each. Ask, run, verify; never skip them or hand them to the owner.
- No subagents unless the owner asks for one in that message.

## Keeping notes

- If the Project section says "Unknown" for something you worked out (deploy style, build command, database, worker name), write the value into the repo's `AGENTS.md` Project section and `~/CompassAgentMemory/projects/<repo>.md` in the same turn.
- Do not edit the other Compass-managed sections. Add a dated line under Manual Notes and tell the owner.
<!-- compass:end:global -->

<!-- compass:start:security -->
# Security

- Never read, print, export, or commit secrets: `.env`, `.dev.vars`, private keys, API tokens, database passwords, wallet files, Wrangler auth files. If unsure whether a file holds secrets, do not display it.
- Never ask the owner to paste a token or secret into chat, and never dump environment variables.
- Use existing authenticated sessions. Set a secret you can generate yourself with `wrangler secret put` (it prompts once); for a third-party key, tell the owner exactly which Cloudflare dashboard field to fill.
<!-- compass:end:security -->

<!-- compass:start:ui -->
# Interface

- Load the `compass-ui` skill before any UI change and read `.compass/ui.md` (the skill creates it if missing). The skill holds the taste, navigation, form, modal, and motion rules.
- Use the project's components and semantic tokens (`background`, `surface`, `foreground`, `muted`, `border`, `accent`). Raw palette classes such as `bg-white` or `text-slate-600` in feature code are defects.
- React: shadcn/ui (Radix) for behaviour-heavy controls. Astro: shared Tailwind components, Starwind first, shadcn/ui where Starwind falls short. Never hand-roll modals, date pickers, comboboxes, menus, or select keyboard behaviour.
- No inline `style` on forms and controls. Short create/edit forms go in an accessible centred modal; login, search, filters, and long workflows stay on a page.
- Owner requirement (2026-09-05): one control-height token (normally 44px) with identical height, box-sizing, font, border, and padding on adjacent selects, inputs, and buttons; related fields in equal-width columns. Do not cap every paragraph to a narrow width or force heading breaks that strand text beside empty space.
- Reuse the app's shared Button, FormDialog, ConfirmDialog, SideSheet, DataTable, PageHeader, and EmptyState (listed in `.compass/ui.md`); in React apps with shadcn install them with `~/CompassAgentMemory/bin/compass-ui-add`, elsewhere create a missing one once rather than composing it again in a screen. One filled primary button per view; buttons 8px apart; every modal, sheet, and drawer closes on Escape, X, and outside click, asks before discarding edits, and stays open with values kept on error. Never use the browser's `alert` or `confirm`.
- Motion: opacity and transform only, 150–220ms (side sheets up to 240ms), `prefers-reduced-motion` honoured; no `transition-all`.
<!-- compass:end:ui -->

<!-- compass:start:stack -->
# Cloudflare

- Default stack: Pages, Workers, D1, R2. Read the repo's `wrangler.toml`/`.json`/`.jsonc`, `package.json`, and deploy scripts before changing anything. Do not create resources, change production bindings, or rotate secrets unless asked.
- Know whether the repo is a git-linked Pages project, a Worker, or both before touching the deploy flow; a separate Worker keeps its own deploy path.
- Prefer the repo's scripts (`npm run build`, `npm run deploy`, `npm run cf:deploy`, `npm run agent:check`).
- Keep using Wrangler. Cloudflare's `cf` CLI is in open beta (September 2026): do not run `cf migrate`, `cf init`, or `cf dev`, add `cloudflare.config.ts`, or swap `wrangler` in scripts unless the owner asks.
- Simple app login (allowlisted email, one-time codes, email and password): load the `simple-app-auth` skill. Workers PBKDF2 rejects more than 100,000 iterations.


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

## Project Commands

Build: npm run build
Test: Unknown
Check: Unknown
Deploy: npm run deploy

## Interface Profile

UI personality: Unknown (choose institutional / product / expressive)
Component foundation: Tailwind shared Astro components (Starwind acceptable)

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

## Feature Map

Where things live, so no session rediscovers the layout. Add what each area does as
you learn it, and add anything this misses.

- `src/pages/` — 404, about, api, auth, consultation, dashboard, doctors
## Manual Notes

Add human notes here.
<!-- compass:end:project -->

<!-- compass:start:workflows -->
# Shipping and verification

- Ship each meaningful change with `/Users/macpro/CompassAgentMemory/bin/compass-ship "message" [files…]`. It stages (everything, or the files named), refuses secret-looking files, refuses new accessibility defects on changed React lines (clickable divs, untyped buttons, missing alt text, browser `alert`/`confirm`; fix them, do not disable the rule), runs the project check, commits, and pushes in one approval. Do not run `git add`, `git commit`, or `git push` yourself, and do not re-run the check it runs. Name the files when the tree holds work that is not yours.
- Run D1 migrations yourself right after adding them: `npx wrangler d1 migrations apply <DB> --remote`. A git-push deploy never applies them.
- In an auto-deploy repo the push is the deploy. Do not sleep, wait, or poll for it. Check a live URL only when the change altered URL or API behaviour; if the new build is not live yet, say it is building and stop.
- Deploy styles, what counts as verification, and the client summary format: load the `compass-workflow` skill.
- When the owner relays client feedback, ship the fix, then add a plain-text summary they can paste into an email: one sentence per item, no technical terms, in its own block.
- Final message under 150 words: what changed, what was verified, what is left.
<!-- compass:end:workflows -->
