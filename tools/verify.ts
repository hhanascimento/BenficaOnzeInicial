/**
 * End-to-end checks for the game data and rules.
 *   node tools/verify.ts
 * Node 24 strips the types, so no build step is needed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Match } from '../src/types.ts';
import {
  aliasHit, buildPool, knownFrom, matchesPlayer, matchesQuery, nameFromSlug,
  normalize as normalizeName,
} from '../src/lib/text.ts';
import type { KnownPlayer } from '../src/lib/text.ts';
import { slotLeft, X_SCALE } from '../src/lib/pitch.ts';
import {
  playerFrequency, maxAverageFrequency, matchDifficulty,
  scoreRound, applyResult, formatTime, EMPTY_STATS, DEFAULT_SETTINGS, shuffleDeck,
} from '../src/lib/game.ts';

const root = resolve(import.meta.dirname, '..');
let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = '') {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

const matches = JSON.parse(readFileSync(resolve(root, 'src/data/matches.json'), 'utf8')) as Match[];
/* Both vocabularies: the English codes of the original dataset and the general
   Portuguese roles the localized dataset carries (see PositionCode). */
const POSITIONS = new Set([
  'GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST',
  'GR', 'DF', 'MC', 'AV',
]);

/* ---------------- dataset ---------------- */
section(`dataset (${matches.length} matches)`);
check('has at least 288 matches', matches.length >= 288, `got ${matches.length}`);

const ids = new Set<string>();
let oldest = '9999';
let newest = '0000';
let totalPhotos = 0;

for (const m of matches) {
  const tag = m.id ?? `${m.date} vs ${m.opponent}`;
  check(`${tag}: unique id`, !ids.has(m.id));
  ids.add(m.id);
  check(`${tag}: 11 starters`, m.lineup.length === 11, `got ${m.lineup.length}`);
  check(`${tag}: has opponent`, !!m.opponent);
  check(`${tag}: has competition`, !!m.competition);
  check(`${tag}: valid ISO date`, /^\d{4}-\d{2}-\d{2}$/.test(m.date), m.date);
  check(`${tag}: home flag is boolean`, typeof m.home === 'boolean');
  if (m.date < oldest) oldest = m.date;
  if (m.date > newest) newest = m.date;
  for (const p of m.lineup) {
    check(`${tag}/${p.name}: valid position`, POSITIONS.has(p.position), p.position);
    check(`${tag}/${p.name}: x in range`, p.x >= 0 && p.x <= 100, String(p.x));
    check(`${tag}/${p.name}: y in range`, p.y >= 0 && p.y <= 100, String(p.y));
    check(`${tag}/${p.name}: has name`, !!p.name.trim());
  }
}
/* ---------------- pitch coordinates ----------------
   The source grid is 80 units wide (every XI is symmetric about x = 40), and
   PlayerSlot stretches it onto the full 0-100% width of the rendered pitch. */
section('pitch coordinates');
check('source grid: no x beyond 80', matches.every((m) => m.lineup.every((p) => p.x <= 80)));

let mirroredCount = 0;
let coordCount = 0;
for (const m of matches) {
  const xs = m.lineup.map((p) => p.x);
  for (const x of xs) {
    coordCount++;
    if (xs.some((v) => Math.abs(v - (80 - x)) <= 0.75)) mirroredCount++;
  }
}
check('source grid: XIs symmetric about x = 40',
  mirroredCount / coordCount > 0.98, `${mirroredCount}/${coordCount}`);

check('mapping: centre of the grid lands mid-pitch', slotLeft(40) === 50, String(slotLeft(40)));
check('mapping: widest source x reaches the far side', slotLeft(73) > 85, String(slotLeft(73)));
check('mapping: narrowest source x stays on the pitch', slotLeft(7) < 15 && slotLeft(7) > 2, String(slotLeft(7)));
check('mapping: never leaves 2-98%', matches.every((m) => m.lineup.every((p) => {
  const v = slotLeft(p.x);
  return v >= 2 && v <= 98;
})));
check('mapping scale is 100/80', X_SCALE === 1.25, String(X_SCALE));

check('date range spans 1960s onward', oldest < '1965-01-01', `oldest ${oldest}`);
console.log(`  date range: ${oldest} → ${newest}`);

/* ---------------- photos on disk ---------------- */
section('photos');
const referenced = new Set<string>();
for (const m of matches) for (const p of m.lineup) if (p.photo) referenced.add(p.photo);
for (const rel of referenced) {
  check(`asset exists: ${rel}`, existsSync(resolve(root, 'public', rel)));
}
const players = new Set(matches.flatMap((m) => m.lineup.map((p) => p.name)));
for (const m of matches) for (const p of m.lineup) if (p.photo) totalPhotos++;
console.log(`  ${players.size} distinct players, ${referenced.size} photos referenced, ${totalPhotos} slot-photos wired`);

const credits = JSON.parse(readFileSync(resolve(root, 'src/data/credits.json'), 'utf8')) as {
  players: Record<string, { name: string; source: string }>;
};
const credited = new Set(Object.keys(credits.players));
for (const rel of referenced) {
  const slug = rel.replace(/^.*\//, '').replace(/\.jpg$/, '');
  check(`photo credited: ${rel}`, credited.has(slug));
}
for (const [slug, c] of Object.entries(credits.players)) {
  check(`credit ${slug}: has name`, !!c.name);
  check(`credit ${slug}: has source url`, /^https?:\/\//.test(c.source));
  check(`credit ${slug}: photo on disk`, existsSync(resolve(root, 'public/assets/players', `${slug}.jpg`)));
}

/* ---------------- name matching ---------------- */
section('name matching');
const pool = buildPool(matches);
const target = (name: string): KnownPlayer =>
  pool.find((p) => normalizeName(p.name) === normalizeName(name)) ?? { name };
const eusebio = target('Eusébio');

check('exact name', matchesPlayer('Eusébio', eusebio, pool));
check('accent-insensitive', matchesPlayer('eusebio', eusebio, pool));
check('case-insensitive', matchesPlayer('COLUNA', target('Mário Coluna'), pool));
check('extra spaces', matchesPlayer('  di   maria ', target('Di María'), pool));
check('unique surname', matchesPlayer('Grimaldo', target('Grimaldo'), pool));
check('empty guess rejected', !matchesPlayer('   ', eusebio, pool));
check('non-player rejected', !matchesPlayer('Lionel Messi', eusebio, pool));
check('wrong surname rejected', !matchesPlayer('Ronaldo', eusebio, pool));

// find a surname shared by two different players in the dataset
const surnameOwners = new Map<string, string[]>();
for (const p of pool) {
  const parts = p.name.split(' ');
  const last = parts[parts.length - 1];
  if (!last) continue;
  surnameOwners.set(last, [...(surnameOwners.get(last) ?? []), p.name]);
}
const shared = [...surnameOwners.entries()].find(
  ([, owners]) => new Set(owners.map((o) => normalizeName(o))).size > 1,
);
if (shared) {
  check(`ambiguous surname rejected (${shared[0]})`,
    !matchesPlayer(shared[0], target(shared[1][0]), pool));
  console.log(`  ambiguous surname example: ${shared[0]} → ${shared[1].join(', ')}`);
} else {
  console.log('  no ambiguous surname in dataset (nothing to assert)');
}

/* A first + last name identifies the player even when the full name carries
   words in between ("mehdi gonzalez" → "Mehdi Carcela Gonzalez"), and word
   order does not matter ("costa rui" → "Rui Costa"). Sweep the whole pool. */
const firstLastFailures: string[] = [];
const reversedFailures: string[] = [];
for (const p of pool) {
  const words = p.name.split(/\s+/);
  if (words.length >= 3 && !matchesPlayer(`${words[0]} ${words[words.length - 1]}`, p, pool)) {
    firstLastFailures.push(`${words[0]} ${words[words.length - 1]} → ${p.name}`);
  }
  const reversed = [...words].reverse().join(' ');
  if (words.length >= 2 && !matchesPlayer(reversed, p, pool)) {
    reversedFailures.push(`${reversed} → ${p.name}`);
  }
}
check('first + last name matches every multi-word name',
  firstLastFailures.length === 0, firstLastFailures.slice(0, 3).join(' | '));
check('word order does not matter', reversedFailures.length === 0, reversedFailures.slice(0, 3).join(' | '));

/* The slug holds the first name the display name leaves out, so every alias it
   produces must identify the player on its own and by its own first + last. */
const aliased = pool.filter((p) => (p.aliases ?? []).length > 0);
check('the slugs contribute aliases', aliased.length > 150, `${aliased.length} players`);
const aliasFailures: string[] = [];
const aliasFirstLastFailures: string[] = [];
for (const p of aliased) {
  for (const alias of p.aliases ?? []) {
    if (!matchesPlayer(alias, p, pool)) aliasFailures.push(`${alias} → ${p.name}`);
    const words = alias.split(/\s+/);
    if (words.length >= 3 && !matchesPlayer(`${words[0]} ${words[words.length - 1]}`, p, pool)) {
      aliasFirstLastFailures.push(`${words[0]} ${words[words.length - 1]} → ${p.name}`);
    }
  }
}
check('every alias identifies its player', aliasFailures.length === 0, aliasFailures.slice(0, 3).join(' | '));
check('first + last of an alias works too',
  aliasFirstLastFailures.length === 0, aliasFirstLastFailures.slice(0, 3).join(' | '));
check('slug reads as a name', nameFromSlug('alejandro-grimaldo') === 'Alejandro Grimaldo',
  nameFromSlug('alejandro-grimaldo'));
check('alias names the right player', matchesPlayer('Alejandro Grimaldo', target('Grimaldo'), pool));
// Two players answer to "Alejandro", so the first name alone must not pick one:
// the first + last form is what disambiguates them.
check('a shared first name stays ambiguous',
  !matchesPlayer('alejandro', target('Escalona'), pool)
  && !matchesPlayer('alejandro', target('Grimaldo'), pool));
check('first + last clears that ambiguity',
  matchesPlayer('alejandro escalona', target('Escalona'), pool)
  && matchesPlayer('alejandro grimaldo', target('Grimaldo'), pool));
check('a first name only one player has is enough',
  matchesPlayer('abdelkrim', target('El Hadrioui'), pool));

/* Every displayed name must be guessable by itself. Aliases feed the pool too,
   so a word another player's alias carries ("nelson-semedo" → "Nelson Semedo")
   made the ambiguity rule refuse the very player the slot names: "Nélson". */
const unguessable = pool.filter((p) => !matchesPlayer(p.name, p, pool)).map((p) => p.name);
check('every player answers to their own displayed name', unguessable.length === 0,
  `${unguessable.length}: ${unguessable.slice(0, 5).join(', ')}`);
check('the word a longer alias shares still finds its own player',
  matchesPlayer('Nélson', target('Nélson'), pool)
  && matchesPlayer('nélson', target('Nélson'), pool));

/* 15 display names in the dataset belong to more than one real player, so the
   alias has to come from the lineup entry's own slug, not from the merged pool
   entry – otherwise "Angelo Martins" would reveal whichever Martins is on the
   pitch. */
const sharedSlugs = new Map<string, { name: string; slug?: string }[]>();
for (const m of matches) {
  for (const p of m.lineup) sharedSlugs.set(p.name, [...(sharedSlugs.get(p.name) ?? []), p]);
}
const crossCheck = [...sharedSlugs.values()].filter(
  (group) => new Set(group.map((p) => p.slug)).size > 1,
);
check('the dataset really does reuse display names', crossCheck.length > 5, `${crossCheck.length} names`);
let crossFailures = 0;
let checkedPairs = 0;
for (const group of crossCheck) {
  for (const a of group) {
    const aliasA = knownFrom(a).aliases?.[0];
    if (!aliasA) continue;
    for (const b of group) {
      if (b === a || b.slug === a.slug) continue;
      checkedPairs++;
      if (matchesPlayer(aliasA, knownFrom(b), pool)) crossFailures++;
    }
  }
}
check('a shared display name keeps the first name of its own entry',
  crossFailures === 0, `${crossFailures}/${checkedPairs} pairs cross-matched`);
console.log(`  ${checkedPairs} same-name pairings checked (${crossCheck.length} shared names)`);

/* Suggestion filter: same idea while the player is still typing. */
const drafted = (q: string) => pool.filter((p) => matchesQuery(p, q)).map((p) => p.name);
check('suggestion: prefix of a surname', drafted('grimal').includes('Grimaldo'), drafted('grimal').join(','));
check('suggestion: first name from the slug', drafted('alejandro').includes('Grimaldo'), drafted('alejandro').join(','));
check('suggestion: first + last, middle words skipped',
  drafted('mehdi gonzalez').includes('Mehdi Carcela Gonzalez'), drafted('mehdi gonzalez').join(','));
check('suggestion: mid-word typing still works', drafted('osta').includes('Costa Pereira'), drafted('osta').join(','));
check('suggestion: explains a slug hit', aliasHit(target('Grimaldo'), 'alejandro') === 'Alejandro Grimaldo',
  String(aliasHit(target('Grimaldo'), 'alejandro')));
check('suggestion: no alias note for the display name',
  aliasHit(target('Grimaldo'), 'grimaldo') === null);

/* ---------------- slot size ----------------
   The circles are sized in `cqw` (percent of the pitch width) so they scale
   with the pitch. The pitch cannot grow – it is capped by the viewport height –
   so making the slots bigger means using more of the pitch, and the ceiling is
   how close two players can stand. The CSS is parsed rather than trusted: the
   widest circle must stay clear of the tightest pair in any XI, and must not
   reach past the pitch edge at the narrowest pitch either.
*/
section('slot size');
const slotCss = readFileSync(resolve(root, 'src/components/PlayerSlot.css'), 'utf8');
const pitchCss = readFileSync(resolve(root, 'src/components/Pitch.css'), 'utf8');

function rule(css: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${esc}\\s*\\{([\\s\\S]*?)\\}`).exec(css);
  if (!m) throw new Error(`rule not found in CSS: ${selector}`);
  return m[1];
}

/** The fluid `clamp(<min px>, <n>cqw, <max px>)` size of a slot part. */
function fluidSize(css: string, selector: string): { cqw: number; maxPx: number } {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of css.matchAll(new RegExp(`${esc}\\s*\\{([\\s\\S]*?)\\}`, 'g'))) {
    const hit = /clamp\(\s*[\d.]+px\s*,\s*([\d.]+)cqw\s*,\s*([\d.]+)px\s*\)/.exec(m[1]);
    if (hit) return { cqw: Number(hit[1]), maxPx: Number(hit[2]) };
  }
  throw new Error(`no clamp(<px>, <cqw>, <px>) size for ${selector}`);
}

const photo = fluidSize(slotCss, '.slot__photo');
const placeholder = fluidSize(slotCss, '.slot__placeholder');
check('slots are sized against the pitch width', photo.cqw > 0 && placeholder.cqw > 0);
check('a placeholder is no bigger than a photo',
  placeholder.cqw <= photo.cqw && placeholder.maxPx <= photo.maxPx,
  `placeholder ${placeholder.cqw}cqw vs photo ${photo.cqw}cqw`);

// pitch geometry, read from the CSS so a change there shows up here
const pitchRule = rule(pitchCss, '.pitch');
const aspect = /aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/.exec(pitchRule);
const capMatch = /width:\s*min\(([^)]*)\)/.exec(pitchRule)?.[1].match(/(\d+)px/);
const insets = rule(pitchCss, '.pitch__slots').match(/inset:\s*([^;]+)/)?.[1].split(/\s+/).map(parseFloat);
if (!aspect || !insets || insets.length !== 4 || !capMatch) {
  throw new Error('could not read the pitch geometry out of Pitch.css');
}
const [aspectW, aspectH] = aspect.slice(1).map(Number);
const hPerW = aspectH / aspectW;                       // pitch height, in pitch widths
const [insetTop, insetRight, insetBottom, insetLeft] = insets;
const layerW = 1 - (insetLeft + insetRight) / 100;     // the slot layer's share of the pitch
const layerH = 1 - (insetTop + insetBottom) / 100;
const maxPitch = Number(capMatch[1]);

// tightest pair of players in the whole dataset, plus the closest a slot centre
// ever comes to an edge – both in units of the pitch width
let tightest = Infinity;
let tightestTag = '';
let minEdgeX = Infinity;
let minEdgeY = Infinity;
for (const m of matches) {
  const lefts = m.lineup.map((p) => slotLeft(p.x));
  for (let i = 0; i < m.lineup.length; i++) {
    minEdgeX = Math.min(minEdgeX,
      insetLeft / 100 + (lefts[i] / 100) * layerW,
      insetRight / 100 + ((100 - lefts[i]) / 100) * layerW);
    const top = (100 - m.lineup[i].y) / 100;
    minEdgeY = Math.min(minEdgeY,
      hPerW * (insetTop / 100 + top * layerH),
      hPerW * (insetBottom / 100 + (1 - top) * layerH));
    for (let j = i + 1; j < m.lineup.length; j++) {
      const dx = ((lefts[i] - lefts[j]) / 100) * layerW;
      const dy = ((m.lineup[i].y - m.lineup[j].y) / 100) * layerH * hPerW;
      const gap = Math.hypot(dx, dy);
      if (gap < tightest) {
        tightest = gap;
        tightestTag = `${m.lineup[i].name} / ${m.lineup[j].name}`;
      }
    }
  }
}

check('a photo fits between the closest two players in any XI',
  photo.cqw / 100 < tightest,
  `${photo.cqw}cqw vs closest pair ${tightest.toFixed(4)} of the pitch width (${tightestTag})`);
check('the pixel cap keeps that spacing even at the widest pitch',
  photo.maxPx < maxPitch * tightest, `${photo.maxPx}px vs ${(maxPitch * tightest).toFixed(1)}px`);
check('a photo stays inside the pitch horizontally',
  photo.cqw / 200 < minEdgeX, `radius ${(photo.cqw / 200).toFixed(4)} vs ${minEdgeX.toFixed(4)}`);
check('a photo stays inside the pitch vertically',
  photo.cqw / 200 < minEdgeY, `radius ${(photo.cqw / 200).toFixed(4)} vs ${minEdgeY.toFixed(4)}`);
check('the pitch has a sane size cap', maxPitch >= 300 && maxPitch <= 560, `${maxPitch}px`);
console.log(`  photo ${photo.cqw}cqw / max ${photo.maxPx}px, placeholder ${placeholder.cqw}cqw`
  + ` — closest pair ${tightest.toFixed(4)} of the pitch width (${tightestTag})`);

/* ---------------- difficulty ---------------- */
section('difficulty');
const freq = playerFrequency(matches);
const maxAvg = maxAverageFrequency(matches, freq);
const stars = matches.map((m) => matchDifficulty(m, freq, maxAvg));
check('every match scores 1..5', stars.every((s) => Number.isInteger(s) && s >= 1 && s <= 5));
const spread = new Set(stars);
check('difficulty actually varies', spread.size >= 3, `levels used: ${[...spread].sort().join(',')}`);
console.log(`  levels used: ${[...spread].sort().join(',')}`);

/* ---------------- scoring ---------------- */
section('scoring');
const full = scoreRound({ total: 11, revealed: 11, seconds: 60, difficulty: 3, usedReveal: false, hintsOn: false });
check('solved round scores points', full.points > 0 && full.solved);
check('faster solve beats slower solve',
  scoreRound({ total: 11, revealed: 11, seconds: 30, difficulty: 3, usedReveal: false, hintsOn: false }).points >
  scoreRound({ total: 11, revealed: 11, seconds: 300, difficulty: 3, usedReveal: false, hintsOn: false }).points);
check('harder match scores more',
  scoreRound({ total: 11, revealed: 11, seconds: 120, difficulty: 5, usedReveal: false, hintsOn: false }).points >
  scoreRound({ total: 11, revealed: 11, seconds: 120, difficulty: 1, usedReveal: false, hintsOn: false }).points);
check('reveal counts as not solved',
  !scoreRound({ total: 11, revealed: 11, seconds: 60, difficulty: 3, usedReveal: true, hintsOn: false }).solved);
check('hints cost points',
  scoreRound({ total: 11, revealed: 11, seconds: 60, difficulty: 3, usedReveal: false, hintsOn: false }).points >
  scoreRound({ total: 11, revealed: 11, seconds: 60, difficulty: 3, usedReveal: false, hintsOn: true }).points);
check('partial round gives partial credit',
  scoreRound({ total: 11, revealed: 4, seconds: 60, difficulty: 3, usedReveal: false, hintsOn: false }).points > 0);
check('zero found gives zero', scoreRound({ total: 11, revealed: 0, seconds: 5, difficulty: 3, usedReveal: false, hintsOn: false }).points === 0);
check('points never negative',
  scoreRound({ total: 11, revealed: 11, seconds: 9999, difficulty: 1, usedReveal: true, hintsOn: true }).points >= 0);

section('stats');
const win = applyResult(EMPTY_STATS, full);
check('win increments streak', win.streak === 1 && win.solved === 1 && win.played === 1);
const twice = applyResult(win, full);
check('second win extends streak', twice.streak === 2 && twice.played === 2);
check('best score tracks the best round', twice.bestScore === full.points);

const partial = scoreRound({ total: 11, revealed: 3, seconds: 100, difficulty: 2, usedReveal: false, hintsOn: false });
const afterPartial = applyResult(twice, partial);
check('loss resets streak but keeps best', afterPartial.streak === 0 && afterPartial.bestStreak === 2);
check('played always increments', afterPartial.played === 3);
check('solved count ignores unfinished rounds', afterPartial.solved === 2);
check('total score accumulates',
  afterPartial.totalScore === twice.totalScore + partial.points,
  `${afterPartial.totalScore} vs ${twice.totalScore + partial.points}`);

section('play order');
const deck = shuffleDeck(matches.length);
check('deck holds every match exactly once', deck.length === matches.length && new Set(deck).size === matches.length);
check('deck only holds valid indices',
  deck.every((i) => Number.isInteger(i) && i >= 0 && i < matches.length), String(deck.length));
check('deck is shuffled rather than in dataset order', deck.some((v, i) => v !== i));
check('two decks are not identical',
  shuffleDeck(matches.length).join() !== shuffleDeck(matches.length).join());

// the deck is walked one match at a time, exactly like nextMatch() does, and the
// wrap-around must reshuffle instead of restarting at match 0
let pass = shuffleDeck(matches.length);
let pos = 0;
const seen = new Set([pass[0]]);
let wrappedWithRepeat = 0;
for (let n = 1; n < matches.length; n++) {
  const lastPlayed = pass[pos];
  if (pos + 1 < pass.length) {
    pos += 1;
  } else {
    pass = shuffleDeck(matches.length, lastPlayed);
    pos = 0;
    if (pass[0] === lastPlayed) wrappedWithRepeat += 1;
  }
  seen.add(pass[pos]);
}
check('one full pass plays every match exactly once',
  seen.size === matches.length, `${seen.size}/${matches.length}`);

// the avoidFirst guard is probabilistic, so hammer it
let badFirst = 0;
for (let n = 0; n < 300; n++) if (shuffleDeck(matches.length, 17)[0] === 17) badFirst += 1;
check('never returns the just-played match first', badFirst === 0, `${badFirst}/300`);
check('wrap-around never repeats the previous match', wrappedWithRepeat === 0, String(wrappedWithRepeat));
check('tiny decks are safe', JSON.stringify(shuffleDeck(1, 0)) === '[0]' && JSON.stringify(shuffleDeck(0)) === '[]');

section('misc');
check('formatTime mm:ss', formatTime(0) === '00:00' && formatTime(65) === '01:05' && formatTime(3600) === '60:00');
check('default settings shape', Object.keys(DEFAULT_SETTINGS).sort().join(',') === 'blind,hard,hints');
check('stats are pure (input untouched)', EMPTY_STATS.played === 0 && EMPTY_STATS.streak === 0);

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
