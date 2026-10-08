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
- The pitch scales with its container (container queries), so the front line never crowds on a
  narrow phone.

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
| `tools/verify.ts` | The `npm test` suite: dataset integrity, photos on disk, credits, name matching, difficulty and scoring rules. |
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
