# Benfica XI — guess the historic line-up

A little football-history game: the app shows a match played by **Sport Lisboa e Benfica**
and you have to name the **11 players** who started it. Each correct guess reveals that
player's photo in his position on the pitch.

Built with **Ionic + React 19 + TypeScript + Vite**.

## Run it

```bash
npm ci        # or: npm install
npm run dev   # http://localhost:3000
npm run build # typecheck (tsc -b) + production build
npm run lint  # oxlint
npm test      # data + photo + rules checks (node tools/verify.ts)
npm run layout # no-scroll layout check in a headless browser (needs playwright)
```

## How the game works

- `Match` metadata (date, opponent, competition, stage, score) is shown at the top.
- 11 slots are laid out on the pitch with their **position** (GK/RB/CB/LB/DM/CM/AM/RW/LW/ST) and
  real formation coordinates.
- Type a name (or pick a suggestion — the autocomplete only offers players from the whole
  database, never just the current XI). Names match accent- and case-insensitively, and a
  surname alone counts only when it is unambiguous.
- A correct guess flips the slot to the player's **photo**; players without a freely-licensed
  photo fall back to their initials.

### Game feel

| Feature | Behaviour |
| --- | --- |
| **Timer** | Starts with the round, stops the moment the XI is complete (or you give up). |
| **Difficulty** | 1–5 stars, derived from how *obscure* the XI is: a star player who appears in dozens of the sampled matches makes a round easier than an XI of one-off names. |
| **Scoring** | `revealed × 100` + time bonus (up to 7 min), × a difficulty multiplier (0.9×–1.3×), minus 15 % if hints are on. Giving up pays only 25 % of the base. |
| **Streak & score** | Current streak and lifetime score in the header, persisted to `localStorage`, plus best streak and best single-round score. |
| **Round summary** | Points, time, difficulty, streak and a line-by-line breakdown of how the score was built. |

### Difficulty modes

Toggleable in-game and remembered between sessions:

- **Hints** — empty slots show each player's first initial (costs 15 % of the score).
- **Blind match** — the score and date are hidden until the round ends.
- **Hard** — autocomplete suggestions are off, so it is pure recall.

### Input

- Autocomplete searches the **whole database**, never just the current XI (no giveaways).
- Arrow keys (↑/↓) move through the suggestions, Enter confirms the highlighted one or submits
  what you typed, Escape closes the list, and there is a clear (×) button.
- A wrong-but-known player reports "already found / not in this XI"; an unknown name shakes the
  field. Matching ignores accents, case and extra spaces; a bare surname is accepted only when
  no other player shares it.
- The pitch scales with its container (container queries). Suggestions open **upwards** because
  the guess field sits at the bottom of the screen.

## Layout — the whole game fits one screen

Nothing scrolls: the header, the match card, the mode toggles, the controls card and the footer
keep their natural height and the **pitch takes what is left**.

- `ion-app` is a `100 %`-tall flex column; `ion-content` is the flexible middle part, so the
  content box has a definite height and `.pitchWrap` can be `height: 100%`.
- `.pitchWrap` is a flex column too: `.pitchStage` is the only child with `flex: 1 1 auto`, and it
  is a `container-type: size`. The pitch is therefore sized from the space that is actually left:

  ```css
  .pitch { width: min(100%, 68cqh, 460px); aspect-ratio: 68 / 100; }
  ```

  `68cqh` is the widest this 68 × 100 pitch can be and still fit vertically, so it shrinks on a
  short window and stays centred instead of pushing the controls off-screen.
- Slots live in `.pitch__slots`, an inset layer (`inset: 5% 2% 4% 2%`), and the slot box is the
  **photo circle** — the name hangs below it as an absolutely positioned chip. So the circle sits
  exactly on the pitch coordinate and is never cut by the pitch edge.
- **Coordinate note:** the source lineups all share one grid — every XI is symmetric about
  `x = 40` and no `x` exceeds 80 (the goalkeeper is on `x = 40` in all 288 matches), i.e. the
  positions are given on an 80-unit-wide pitch. `src/lib/pitch.ts` stretches that onto the full
  width (`x × 1.25`), otherwise every formation would sit squashed into the left of the field.
- Short screens get a tighter chrome (smaller cards, no difficulty stars under 660 px) and, under
  520 px, the toggles and footer step aside. Once the round is over the match card and toggles are
  replaced by the summary (which repeats the fixture), so the pitch stays readable in the recap.
- The autocomplete list opens upwards, otherwise it would fall off the bottom and create a
  scrollbar.

`tools/layout-check.mjs` drives the real app in headless Chromium at 11 viewport sizes × 5 game
states (start, suggestions open, wrong guess, right guess, round finished) and fails if any
scroller overflows, if a photo is clipped by the pitch edge or if the pitch gets too small.
On a machine without Chromium or system fonts, `tools/browser-setup.sh` unpacks a browser plus
its shared libraries locally (no root needed).

### Attribution

The footer's **photo credits** button opens the provenance of every downloaded photo
(`src/data/credits.json`), each linked to the Wikipedia article it came from.

## Data

| File | Contents |
| --- | --- |
| `src/data/matches.json` | 288 matches (1961 → 2026), each with the starting XI, positions and pitch coordinates. Generated, do not hand-edit. |
| `src/data/players.json` | Player index (slug → display name + photo path). |
| `src/data/credits.json` | Photo provenance: for every photo, the Wikipedia article it came from. |
| `tools/data/matches.raw.json` | The raw scrape (with source ids) that `matches.json` is built from. |
| `tools/verify.ts` | The `npm test` suite: dataset integrity, photos on disk, credits, name matching, difficulty and scoring rules, and the pitch-coordinate grid. |
| `tools/layout-check.mjs` | The `npm run layout` suite: no scrolling, no clipped players and a usable pitch at 11 viewports × 5 states. |
| `tools/browser-setup.sh` | Unpacks headless Chromium + fonts + shared libs into `/tmp` for the layout check (no root). |
| `public/assets/players/*.jpg` | 149 player photos, ~2 MB total. |

Coverage: **288 matches**, **373 distinct players**, **149 players with a photo (40 %)**.
Photos exist mainly for well-documented players; for older or minor players Wikipedia has no
freely-licensed portrait, so those slots show initials.

## Photo pipeline (`tools/`)

Photos are pulled from Wikipedia/Wikimedia Commons and then **verified**, because a naive
name lookup happily returns a butterfly for `Alcides`, a cathedral for `Lima` and the prophet
Elijah for `Eliseu`.

1. `photos.py` — batched `pageimages` lookups on pt/en Wikipedia, then (for hard names) search.
2. `wd.py` — Wikidata search with accent/nickname tolerance, filtered on the "footballer"
   description, then the `P18` image property.
3. `verify3.py` — **accuracy gate**: downloads the raw wikitext of each candidate article and
   keeps the photo only if the text mentions *Benfica* **and** a football term and is not a
   disambiguation/name page.
4. `dl.py` — downloads the thumbnails, resizes them to 220 px JPEG and writes them into
   `public/assets/players/`.

Wikimedia rate-limits aggressively from shared/cloud IPs (HTTP 429). Every response is cached
in `wcache/` and each stage is resumable, so simply re-running a stage continues where it
stopped. `tm.py` scrapes the match/line-up data (Transfermarkt publicly allows crawling).

> Licensing: the photos are freely licensed, but several require attribution. Check
> `src/data/credits.json` before redistributing, and update the footer credit if you publish.
