import type { Match } from '../types';

/* ------------------------------------------------------------------ *
 * Settings (persisted so the player's preferred options stick)
 * ------------------------------------------------------------------ */

export interface Settings {
  /** Show a first-letter hint inside each unknown slot. */
  hints: boolean;
}

export const DEFAULT_SETTINGS: Settings = { hints: false };

const SETTINGS_KEY = 'benfica-xi:settings';
const STATS_KEY = 'benfica-xi:stats';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — the game still works in-memory */
  }
}

export function loadSettings(): Settings {
  return readJSON<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS);
}
export function saveSettings(s: Settings) {
  writeJSON(SETTINGS_KEY, s);
}

/* ------------------------------------------------------------------ *
 * Career stats
 * ------------------------------------------------------------------ */

export interface Stats {
  played: number;
  solved: number;
  streak: number;
  bestStreak: number;
  bestScore: number;
  totalScore: number;
}

export const EMPTY_STATS: Stats = {
  played: 0,
  solved: 0,
  streak: 0,
  bestStreak: 0,
  bestScore: 0,
  totalScore: 0,
};

export function loadStats(): Stats {
  return readJSON<Stats>(STATS_KEY, EMPTY_STATS);
}
export function saveStats(s: Stats) {
  writeJSON(STATS_KEY, s);
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export interface RoundInput {
  total: number;
  revealed: number;
  seconds: number;
  /** The player pressed "Reveal" instead of finishing it themselves. */
  usedReveal: boolean;
  /** Hint mode was on during the round. */
  hintsOn: boolean;
}

export interface RoundResult {
  points: number;
  base: number;
  timeBonus: number;
  hintPenalty: number;
  solved: boolean;
}

const PER_PLAYER = 100;
const TIME_BUDGET = 420; // seconds after which there is no speed bonus left

export function scoreRound(input: RoundInput): RoundResult {
  const base = input.revealed * PER_PLAYER;
  const solved = input.revealed === input.total && !input.usedReveal;
  const timeBonus = solved ? Math.max(0, TIME_BUDGET - input.seconds) : 0;
  const hintPenalty = input.hintsOn ? Math.round(base * 0.15) : 0;
  const raw = solved ? base + timeBonus - hintPenalty : base * 0.25;
  return {
    points: Math.max(0, Math.round(raw)),
    base,
    timeBonus,
    hintPenalty,
    solved,
  };
}

export function applyResult(stats: Stats, result: RoundResult): Stats {
  const next: Stats = {
    played: stats.played + 1,
    solved: stats.solved + (result.solved ? 1 : 0),
    streak: result.solved ? stats.streak + 1 : 0,
    bestStreak: Math.max(stats.bestStreak, result.solved ? stats.streak + 1 : stats.streak),
    bestScore: Math.max(stats.bestScore, result.points),
    totalScore: stats.totalScore + result.points,
  };
  return next;
}

/* ------------------------------------------------------------------ *
 * Formatting / misc
 * ------------------------------------------------------------------ */

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Short, human date for a match (e.g. "4 May 1961"). */
export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-PT', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/**
 * Play order. `size` matches are played in a random order: the returned deck is
 * a shuffled list of match indices that the game walks from start to finish, so
 * nothing repeats until every match has been played once — then it is reshuffled.
 * `avoidFirst` (pass the match just played) keeps the wrap-around from repeating
 * the previous match straight away. `shuffled` is the same Fisher–Yates over an
 * arbitrary list, used for the match indices of a chosen era.
 */
export function shuffled<T>(items: readonly T[], avoidFirst?: T): T[] {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  if (deck.length > 1 && avoidFirst !== undefined && deck[0] === avoidFirst) {
    [deck[0], deck[1]] = [deck[1], deck[0]];
  }
  return deck;
}

export function shuffleDeck(size: number, avoidFirst = -1): number[] {
  return shuffled(
    Array.from({ length: size }, (_, i) => i),
    avoidFirst,
  );
}


/* ------------------------------------------------------------------ *
 * Eras — the period a game is drawn from
 * ------------------------------------------------------------------ */

/** A range of years, both ends included (1960 … 1969 is the 1960s). */
export interface EraRange {
  from: number;
  to: number;
}

export interface EraPreset extends EraRange {
  label: string;
}

/** The decades the dataset actually covers (see yearBounds). */
export const ERA_PRESETS: EraPreset[] = [
  { label: 'Anos 60', from: 1960, to: 1969 },
  { label: 'Anos 70', from: 1970, to: 1979 },
  { label: 'Anos 80', from: 1980, to: 1989 },
  { label: 'Anos 90', from: 1990, to: 1999 },
  { label: 'Anos 2000', from: 2000, to: 2009 },
  { label: 'Anos 2010', from: 2010, to: 2019 },
  { label: 'Anos 2020', from: 2020, to: 2029 },
];

const ERA_KEY = 'benfica-xi:era';

/** The year a match was played, from its ISO date. */
export function matchYear(match: Match): number {
  return Number.parseInt(match.date.slice(0, 4), 10);
}

/** The earliest and latest year in the dataset, used for the "all" option. */
export function yearBounds(matches: Match[]): EraRange {
  if (matches.length === 0) return { from: 0, to: 0 };
  let from = Infinity;
  let to = -Infinity;
  for (const m of matches) {
    const y = matchYear(m);
    if (y < from) from = y;
    if (y > to) to = y;
  }
  return { from, to };
}

/** Indices of the matches played between `from` and `to`, both inclusive. */
export function matchesInRange(matches: Match[], from: number, to: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < matches.length; i++) {
    const y = matchYear(matches[i]);
    if (y >= from && y <= to) indices.push(i);
  }
  return indices;
}

/** The preset a range is exactly equal to, if any. */
export function presetFor(range: EraRange): EraPreset | undefined {
  return ERA_PRESETS.find((p) => p.from === range.from && p.to === range.to);
}

/** "Todas as épocas", "Anos 60" or "1974–1982" for a handpicked range. */
export function formatEraLabel(range: EraRange, bounds: EraRange): string {
  if (range.from <= bounds.from && range.to >= bounds.to) return 'Todas as épocas';
  return presetFor(range)?.label ?? `${range.from}–${range.to}`;
}

/** The era last played, so the picker opens on the previous choice. */
export function loadEra(): EraRange | null {
  try {
    const raw = localStorage.getItem(ERA_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<EraRange>;
    if (typeof value?.from === 'number' && typeof value?.to === 'number' && value.from <= value.to) {
      return { from: value.from, to: value.to };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveEra(range: EraRange) {
  writeJSON(ERA_KEY, range);
}
