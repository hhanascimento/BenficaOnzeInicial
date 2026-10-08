/**
 * End-to-end checks for the game data and rules.
 *   node tools/verify.ts
 * Node 24 strips the types, so no build step is needed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Match } from '../src/types.ts';
import { matchesPlayer, normalize as normalizeName } from '../src/lib/text.ts';
import {
  playerFrequency, maxAverageFrequency, matchDifficulty,
  scoreRound, applyResult, formatTime, EMPTY_STATS, DEFAULT_SETTINGS,
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
const POSITIONS = new Set(['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST']);

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
const pool = Array.from(players).sort();
check('exact name', matchesPlayer('Eusébio', 'Eusébio', pool));
check('accent-insensitive', matchesPlayer('eusebio', 'Eusébio', pool));
check('case-insensitive', matchesPlayer('COLUNA', 'Mário Coluna', pool));
check('extra spaces', matchesPlayer('  di   maria ', 'Ángel Di María', pool));
check('unique surname', matchesPlayer('Grimaldo', 'Alejandro Grimaldo', pool));
// find a surname shared by two different players in the dataset
const surnameOwners = new Map<string, string[]>();
for (const n of pool) {
  const parts = n.split(' ');
  const last = parts[parts.length - 1];
  if (!last) continue;
  surnameOwners.set(last, [...(surnameOwners.get(last) ?? []), n]);
}
const shared = [...surnameOwners.entries()].find(
  ([, owners]) => new Set(owners.map((o) => normalizeName(o))).size > 1,
);
if (shared) {
  check(`ambiguous surname rejected (${shared[0]})`, !matchesPlayer(shared[0], shared[1][0], pool));
  console.log(`  ambiguous surname example: ${shared[0]} → ${shared[1].join(', ')}`);
} else {
  console.log('  no ambiguous surname in dataset (nothing to assert)');
}
check('empty guess rejected', !matchesPlayer('   ', 'Eusébio', pool));
check('non-player rejected', !matchesPlayer('Lionel Messi', 'Eusébio', pool));
check('wrong surname rejected', !matchesPlayer('Ronaldo', 'Eusébio', pool));

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

section('misc');
check('formatTime mm:ss', formatTime(0) === '00:00' && formatTime(65) === '01:05' && formatTime(3600) === '60:00');
check('default settings shape', Object.keys(DEFAULT_SETTINGS).sort().join(',') === 'blind,hard,hints');
check('stats are pure (input untouched)', EMPTY_STATS.played === 0 && EMPTY_STATS.streak === 0);

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
