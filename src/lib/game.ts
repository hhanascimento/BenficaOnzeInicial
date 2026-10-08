import type { Match } from '../types';

/* ------------------------------------------------------------------ *
 * Settings (persisted so the player's preferred difficulty sticks)
 * ------------------------------------------------------------------ */

export interface Settings {
  /** Show a first-letter hint inside each unknown slot. */
  hints: boolean;
  /** Hide the score and date of the match until it is finished. */
  blind: boolean;
  /** Hide the autocomplete list — pure recall. */
  hard: boolean;
}

export const DEFAULT_SETTINGS: Settings = { hints: false, blind: false, hard: false };

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
 * Difficulty — derived from how obscure the XI is across the dataset.
 * A player who shows up in many sampled matches is a household name;
 * one who appears once is hard to recall.
 * ------------------------------------------------------------------ */

export function playerFrequency(matches: Match[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const m of matches) {
    for (const p of m.lineup) freq.set(p.name, (freq.get(p.name) ?? 0) + 1);
  }
  return freq;
}

function lineupAvgFrequency(match: Match, freq: Map<string, number>): number {
  const total = match.lineup.reduce((sum, p) => sum + (freq.get(p.name) ?? 1), 0);
  return total / Math.max(1, match.lineup.length);
}

/** Highest average appearance count across the whole dataset (normaliser). */
export function maxAverageFrequency(matches: Match[], freq: Map<string, number>): number {
  return matches.reduce((max, m) => Math.max(max, lineupAvgFrequency(m, freq)), 1);
}

/** 1 (easiest, all-time XI) … 5 (hardest, obscure XI). */
export function matchDifficulty(match: Match, freq: Map<string, number>, maxAvg: number): number {
  const avg = lineupAvgFrequency(match, freq);
  const span = Math.max(1, maxAvg - 1);
  const ratio = Math.min(1, Math.max(0, (avg - 1) / span));
  const stars = Math.round(1 + (1 - ratio) * 4);
  return Math.min(5, Math.max(1, stars));
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export interface RoundInput {
  total: number;
  revealed: number;
  seconds: number;
  difficulty: number;
  /** The player pressed "Reveal" instead of finishing it themselves. */
  usedReveal: boolean;
  /** Hint mode was on during the round. */
  hintsOn: boolean;
}

export interface RoundResult {
  points: number;
  base: number;
  timeBonus: number;
  multiplier: number;
  hintPenalty: number;
  solved: boolean;
}

const PER_PLAYER = 100;
const TIME_BUDGET = 420; // seconds after which there is no speed bonus left

export function scoreRound(input: RoundInput): RoundResult {
  const base = input.revealed * PER_PLAYER;
  const solved = input.revealed === input.total && !input.usedReveal;
  const timeBonus = solved ? Math.max(0, TIME_BUDGET - input.seconds) : 0;
  const multiplier = 0.8 + input.difficulty * 0.1; // 0.9x … 1.3x
  const hintPenalty = input.hintsOn ? Math.round(base * 0.15) : 0;
  const raw = solved ? (base + timeBonus) * multiplier - hintPenalty : base * 0.25;
  return {
    points: Math.max(0, Math.round(raw)),
    base,
    timeBonus,
    multiplier,
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

export function difficultyLabel(stars: number): string {
  return ['', 'Casual', 'Familiar', 'Tricky', 'Deep cut', 'Obscure'][stars] ?? 'Tricky';
}
