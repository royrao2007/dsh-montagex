# MontageX

**A full-pipeline AI video production harness for DeepSeek Harness — from brief to final cut.**

MontageX is a `dsh-plugin` that turns one sentence of intent into a deliverable
film. It does not implement a second agent loop: DeepSeek Harness thinks, asks,
approves and runs; MontageX supplies the director's knowledge and the media
pipeline.

---

## What it does

| Stage | Capability |
|---|---|
| Triage | `mont_brief` classifies type, platform, duration and aspect, and asks exactly one round of clarifying questions — never a numbered menu in prose |
| Planning | Derive shot count from type and duration; mark each shot's framing, camera move, lighting and continuity locks |
| Storyboard | Cells on one continuous timeline: one shot per cell, with "where am I in the cut" always answerable |
| Generation | Image / video / audio; swappable protocols; full pipeline runs on `mock` with no API key |
| Canvas | Infinite shot board: 16:9 cards, live wiring, grouping, act-based layout |
| Editing | Timeline, smart cut, mixing, subtitles, grading — all local ffmpeg |
| QC | Deterministic checks for duration, aspect, black frames, loudness and pacing; the model never "feels" that it passed |
| Team | Roles, shot claiming, shot-level review notes and signing gates — see below |

**161 tools**, all prefixed `mont_`: 153 production tools plus 8 team tools.
Ships 359 knowledge articles, 196 skills and 15 recipes.

---

## Team collaboration

A production is rarely one person's work: a director sets intent, a storyboarder
cuts shots, a generator runs the expensive calls, and someone else signs off.
MontageX adds that layer on top of the existing pipeline without changing it.

**Five roles** — `director` / `storyboarder` / `generator` / `reviewer` /
`viewer`, narrowing in that order. The first member needs no authority;
afterwards only a `manage` holder can add people.

**Three things are actually enforced:**

1. **Claiming** — a shot can be in only one person's hands at a time, so two
   people never run the same expensive generation twice.
2. **Notes** — comments anchor to a shot id rather than to a chat log; an
   unresolved `request` blocks sign-off.
3. **Signing gate** — `mont_team_approve_stage` refuses while any change request
   on that stage's shots is still open. That is the entire point of a gate.

The board is plain data at `<outputDir>/team/<productionId>.json`, so a team
sharing a folder (or a git repo) sees the same board.

```
mont_team_add_member     add a member and assign a role
mont_team_assign         claim a shot for someone
mont_team_complete       mark it done and release the claim
mont_team_note           leave a note (request / note / approval)
mont_team_resolve        resolve a note
mont_team_approve_stage  sign a stage (refused while requests are open)
mont_team_board          read the board: members, claims, notes, sign-offs, blockers
mont_team_whoami         role and permission matrix
```

---

## Quick start

**Install from npm** (recommended, shortest):

```bash
dsh plugin --profile web add dsh-montagex
dsh web
```

**From the Web UI:** open *Plugins → Add plugin* and enter just
`dsh-montagex` — not a whole terminal command line, and without the
`dsh plugin --profile web add` prefix.

Equivalent forms:

```bash
# Pin a version
dsh plugin --profile web add dsh-montagex@0.2.0

# Install straight from GitHub, when npm is unreachable
dsh plugin --profile web add github:royrao2007/dsh-montagex
```

> The field accepts a package name, a `github:` shorthand or complete git URL, or
> an absolute local directory. The slash form `royrao2007/dsh-montagex` is **not**
> accepted, and neither is a double-protocol mirror prefix (two `https://` in one
> URL) — it fails with `a URL must point at a git repository or a tarball`.
> When the default host is unreachable, use the npm package name instead.

Open **Settings → MontageX** and switch each of the four capabilities:
Vision / Image / Video / Audio.

### Two install errors you may hit

**① `ERR_PNPM_IGNORED_BUILDS: canvas@2.11.2`**

`canvas` is an optional native dependency of `fabric` (pulled in through
`tui-image-editor`), and it frequently fails to compile on Windows. It does
**not** affect MontageX, but pnpm 11 treats an unapproved build script as an
error, so the install is reported as failed.

Add one line to the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  canvas: false
```

The profile directory is normally `%USERPROFILE%\.dsh\profiles\<profile>`, or
`profiles\<profile>` under the DSH_HOME set in DSH's settings.

**② `ERR_PNPM_EPERM: rename <pkg>_tmp_* -> <pkg>`**

pnpm could not rename a package's temp directory to its final name because
Windows refused. The cause is **DSH still running** — its processes hold
directory handles inside `node_modules`.

Fully quit DSH first (right-click the tray icon → Quit, not just closing the
window), then install. If debris remains, delete every `*_tmp_*` directory under
`node_modules` and retry.

Neither error affects the finished install: check that
`node_modules/dsh-montagex/lib/index.js` exists and you are good.

No API key is required to try it: set all four capabilities to `mock` and the
whole chain — triage → storyboard → generate → assemble → QC — runs end to end,
so you can validate the workflow before spending anything.

| Stage | What to do |
|---|---|
| First | Switch all four capabilities to `mock` and run the full chain |
| With a key | Fill Base URL and Key, enable that capability |
| New provider | Give DSH the model id, docs and key and run the onboarding flow; unknown HTTP protocols go through `generic-rest` |

Disabling a capability removes its tools from the model's tool catalog
immediately, with no restart.

---

## Protocols

13 modes across four capabilities:

| Capability | Modes |
|---|---|
| vision | `deepseek-chat` · `openai-chat` · `mock` |
| image | `openai-images` · `tasks` · `mock` |
| video | `openai-videos` · `tasks` · `kling` · `runway` · `mock` |
| audio | `openai-tts` · `mock` |

`generic-rest` is the fallback: a provider that matches no built-in mode can be
wired up by filling in a closed AdapterSpec, with no code changes.

---

## Requirements

- **DeepSeek Harness `>=0.2.2-rc.1 <0.3.0-0`** (`engines.dsh` in `package.json`)
- **Node.js ≥ 24.9.0**
- `ffmpeg` on this machine for editing and QC (when it is missing, tools fail
  loudly instead of silently producing nothing)

---

## Licence

Two parts, declared separately so neither claim overreaches:

- Code and content derived from **DirectorX** — **Apache-2.0**; attribution in
  [NOTICE](NOTICE), full text in [LICENSE](LICENSE)
- MontageX's original team-collaboration module (`src/team.ts`,
  `src/team-tools.ts`, `tests/team.test.mjs`) — **MIT**, see [LICENSE-MIT](LICENSE-MIT)

Keep `LICENSE`, `LICENSE-MIT` and `NOTICE` when redistributing.

---

## Acknowledgements

MontageX began as [DirectorX](https://github.com/LaplaceYoung/dsh-directorx) by
**[LaplaceYoung](https://github.com/LaplaceYoung)**. The production pipeline,
knowledge corpus, skills and canvas all came from that project; the team
collaboration layer is our addition. Thank you for releasing it under a licence
that lets others build on it.

---

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

`npm test` runs typecheck and build before the tests, so committed artifacts stay
in sync with the source.

The tool inventory is frozen in `tests/fixtures/tool-inventory.json`: any
unintended tool addition or removal fails the suite. Deliberate changes must
update that snapshot in the same commit.
