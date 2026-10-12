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

## Screens

The app has four screens, one mounted at a time (`src/App.tsx`):

| Screen | Component | What it does |
| --- | --- | --- |
| **Home** | `src/components/Home.tsx` | The app logo (club crest + the **ONZE INICIAL** wordmark) and two ways in: **Jogar** (the pitch game) and **Instruções**. Also repeats the saved career stats once you have played. |
| **Era picker** | `src/components/EraSelect.tsx` | Shown **before every game**: which period should the XI come from? The whole history, one of the seven decades (Anos 60 … Anos 2020) or a handpicked `from`/`to` year range. Each option shows how many matches it holds, and a range with no matches cannot be started. |
| **Game** | `src/components/Game.tsx` | The pitch game — one historic XI per round, drawn from the chosen era. A home button in the header returns to the intro screen; **Novo Jogo** reopens the era picker. |
| **Instructions** | `src/components/Help.tsx` | "Como jogar": the rules, how player names match, the scoring and what every button does. |

Everything is in Portuguese (pt-PT). Because only one screen is mounted at a time, leaving the
pitch also stops its clock and no stale round is shown when you come back.

Two marks carry the identity:

| File | What it is |
| --- | --- |
| `public/assets/benfica-logo.svg` | The on-screen logo lockup: the official club crest, the **ONZE INICIAL** wordmark and the red-to-gold rule. |
| `public/favicon.svg` | The browser/app icon: a rounded red gradient plate with a gold rule and **BENFICA / ONZE / INICIAL** in white and gold. |

Every wordmark is **Roboto** (Apache-2.0) **converted to outlines** — the logo lockup in Bold, the
icon in Black — so the files are font-independent and render identically in every browser and shell.
(A plain `<text>` favicon silently falls back to whatever font the device happens to have: Android
has neither Impact nor Arial Black, so the design would drift.) `tools/wordmark.py` regenerates
`public/favicon.svg` from a Roboto TTF.

The Android launcher icons keep the crest artwork alone — at launcher sizes the wordmark would be
illegible and the adaptive-icon mask would clip it.

The Android wrapper is **portrait only**: `MainActivity` is declared
`android:screenOrientation="portrait"` (so the splash is locked too, and rotation never re-creates the
activity) and the `<application>` carries `android:appCategory="game"`. The category matters because
apps targeting API 36 have their orientation lock ignored on displays of `sw >= 600dp`, and
**games are the documented exception** to that rule. The alternative, temporary opt-out is a
`android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` property — but it stops working at
API 37. Browsers ignore orientation locks, so the web build keeps its wide two-column layout.

## How the game works

- `Match` metadata (date, opponent, competition, stage, score) is shown at the top.
- 11 slots are laid out on the pitch with their **position** (GK/RB/CB/LB/DM/CM/AM/RW/LW/ST) and
  real formation coordinates.
- Type a name (or pick a suggestion — the autocomplete only offers players from the whole
  database, never just the current XI). Names match accent- and case-insensitively, and a
  surname alone counts only when it is unambiguous.
- A correct guess flips the slot to the player's **photo**; players without a freely-licensed
  photo fall back to their initials.
- The suggestion list always shows the player's **fuller name** on the right — a slot displayed
  as "de Tomás" is offered as `de Tomás · Raul De Tomas` — and hides it only for the handful of
  players known by a single name.

### Game feel

| Feature | Behaviour |
| --- | --- |
| **Timer** | Starts with the round, stops the moment the XI is complete (or you give up). |
| **Scoring** | `revealed × 100` + time bonus (up to 7 min), minus 15 % for each hint used (so both hints cost 30 %). Giving up pays only 25 % of the base. |
| **Streak & score** | Current streak and lifetime score in the header, persisted to `localStorage`, plus best streak and best single-round score. |
| **Round summary** | Points, time, streak and a line-by-line breakdown of how the score was built. |
| **Era** | Every game starts by choosing a period: the whole history, a decade, or a custom `from`–`to` year range. Within one game the era is fixed; the footer shows it and how many matches it holds, and the deck wraps around only that subset. The last choice is remembered and highlighted, but the picker always appears, so a new game is always a deliberate choice. |

### Options

Two hints, each a separate toggle on the pitch. They are **per match**, not a saved preference: every match starts with both off, and once you switch a hint on it stays for the rest of that match — restarting the round included — and clears only on the next match.

- **Dica - Iniciais** — empty slots show each player's **initials** (first and last letter: `HC` for Hélder Cristóvão, `CP` for Costa Pereira). The display name is usually just the surname, so a one-word name is expanded through the source slug to reach the first name; a name already written in two words keeps its own letters (`Bastos Lopes` → `BL`).
- **Dica - Número Camisola** — empty slots show the player's **shirt number** for the 88 % of dataset slots that carry one; the rest show nothing for this hint.

Each hint costs 15 % of the score, so switching on both costs 30 %.

### Input

- Autocomplete searches the **whole database**, never just the current XI (no giveaways), and
  **ranks** what it finds: a name that *starts* with what you typed comes first, and a weak
  mid-word coincidence (`toni` inside `António …`) is only offered when no prefix match exists —
  otherwise those substrings used to fill the six slots and hide the real `Toni`.
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
  `x = 40` and no `x` exceeds 80 (the goalkeeper is on `x = 40` in all 480 matches), i.e. the
  positions are given on an 80-unit-wide pitch. `src/lib/pitch.ts` stretches that onto the full
  width (`x × 1.25`), otherwise every formation would sit squashed into the left of the field.
- Short screens get a tighter chrome (smaller cards, tighter summary) and, under
  520 px, the toggles and footer step aside. Once the round is over the match card and toggles are
  replaced by the summary (which repeats the fixture), so the pitch stays readable in the recap.
- The autocomplete list opens upwards, otherwise it would fall off the bottom and create a
  scrollbar.
- The era picker is the one screen that scrolls (it is a list of options, not a board); the game
  screen still fits a single viewport at every tested size.

`tools/layout-check.mjs` drives the real app in headless Chromium: it steps through the intro
screen and the era picker, then plays 11 viewport sizes × 5 game states (start, suggestions open,
wrong guess, right guess, round finished) and fails if any scroller overflows, if a photo is
clipped by the pitch edge or if the pitch gets too small. It also checks the picker itself for a
full set of options and no horizontal overflow.
On a machine without Chromium or system fonts, `tools/browser-setup.sh` unpacks a browser plus
its shared libraries locally (no root needed).

## Data

**There is one dataset file: `src/data/matches.json`.** It holds the matches *and* everything the
app needs about a player (display name, slug and photo path), so a separate player index and a
separate "raw scrape" copy are not kept — both were removed, since the index was derivable from the
matches and the raw copy differed only in 105 competition/stage strings.

| File | Contents |
| --- | --- |
| `src/data/matches.json` | 480 matches (1961 → 2026), each with the starting XI, positions and pitch coordinates. Generated, do not hand-edit. |
| `tools/tm_expand.py`, `tools/merge_matches.py`, `tools/fill_photos.py` | Extend the dataset: pick and scrape more matches per decade, localize and merge them, and resolve photos for players that have none. |
| `tools/verify.ts` | The `npm test` suite: dataset integrity, photos on disk, name matching, hint initials, suggestion ranking and fuller names, era ranges, scoring rules (both hints), and the pitch-coordinate grid. |
| `tools/layout-check.mjs` | The `npm run layout` suite: the era picker, then no scrolling, no clipped players and a usable pitch at 11 viewports × 5 states. |
| `tools/browser-setup.sh` | Unpacks headless Chromium + fonts + shared libs into `/tmp` for the layout check (no root). |
| `public/assets/players/*` | 439 player photos, ~6.6 MB total (all real JPEGs, ≤400 px, no metadata). |
| `tools/optimize_photos.py` | Compresses those photos: quality-85 progressive JPEG, metadata dropped, long side capped at 400 px, and a file is only replaced when the result is strictly smaller. |
| `tools/link_photos.py` | Points a lineup entry at `assets/players/<slug>.jpg` when that file now exists (a hand-fetched photo would otherwise sit unused), and reports any entry that still has no photo. |
| `tools/wordmark.py` | Converts a Roboto TTF into SVG outlines and regenerates `public/favicon.svg`. |

Coverage: **480 matches**, **439 distinct player slugs**, **every one with a photo on disk** —
**5 280 of 5 280 slot-photos (100 %)** resolve to a real image, so no slot falls back to initials.

Matches per era, which is also what the era picker offers:

| Era | Matches | Note |
| --- | ---: | --- |
| Anos 60 | 46 | Transfermarkt has lineups for only 46 matches of the decade — all used |
| Anos 70 | 14 | …only 14 exist — all used |
| Anos 80 | 18 | …only ~20 exist |
| Anos 90 | 102 | |
| Anos 2000 | 100 | |
| Anos 2010 | 100 | |
| Anos 2020 | 100 | |

Transfermarkt only publishes a formation graphic (the source of the XI, positions and pitch
coordinates) for a minority of pre-1996 matches, and mostly for the European ties. The 1960s, 1970s
and 1980s are therefore at the ceiling of what that source holds; `zerozero.pt`, `worldfootball.net`
and `besoccer` all answer automated requests with a Cloudflare challenge, so they could not be used.

Two players named **Júlio César** exist in the data and must not be confused: the goalkeeper
(`julio-cesar`, 2009–2018, #12/#13/#20) and the defender (`julio-cesar-defesa`, 2001–2002, #5,
displayed as *Julio Cesar (Defesa)*). They have their own slugs and their own photos.

Three different players are called **Fonseca**, and each has his own slug and photo: `alberto-fonseca`
(a 1970s centre-back), `francisco-fonseca` (the Mexican midfielder, 2007) and `fonseca` (the 1989
left-back, **António Manuel Tavares Fonseca**, b. 1965). Only the last one had no freely-licensed
image on Wikimedia; that photo was fetched by hand, and because the original is a small scan
(100 × 132 px) it looks soft wherever a wide screen scales the slot up.

One display name disagrees with its slug: **`leotm`** is the source page's shorthand for the player
the game shows as **Léo** (his photo stays at `leotm.jpg`). A slug only feeds an alias when it reads
as more than one word, so the shorthand is never shown beside the suggestion and is not accepted as
an answer — see `aliasFromSlug`.

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
4. `dl.py` — downloads the thumbnails and writes them into `public/assets/players/`.
5. `optimize_photos.py` — a final pass over the whole directory: progressive JPEG at quality 85,
   no metadata, long side capped at 400 px, never a file bigger than the one it replaced.
   `link_photos.py` then wires any newly added file into the dataset.

Wikimedia rate-limits aggressively from shared/cloud IPs (HTTP 429). Every response is cached
in `wcache/` and each stage is resumable, so simply re-running a stage continues where it
stopped. `tm.py` scrapes the match/line-up data (Transfermarkt publicly allows crawling).

> Licensing: the photos are freely licensed, but several require attribution. Check the source
> Wikipedia/Wikimedia Commons article before redistributing.
