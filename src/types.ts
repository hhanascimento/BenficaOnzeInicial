export type PositionCode =
  | 'GK'
  | 'RB' | 'CB' | 'LB'
  | 'DM' | 'CM' | 'AM'
  | 'RW' | 'LW' | 'ST';

export interface LineupPlayer {
  /** Display name, short form used in the game (e.g. "Coluna"). */
  name: string;
  /** Full name as recorded in the source (e.g. "Mário Coluna"). */
  fullName?: string;
  position: PositionCode;
  /** Pitch coordinates in percent of the pitch area (0-100). x=0 left, y=0 own goal-line. */
  x: number;
  y: number;
  /** Path to the photo, relative to the app base (e.g. "assets/players/eusebio.jpg"). */
  photo?: string;
  /** Optional shirt number. */
  number?: number;
}

export interface Match {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  home: boolean;
  opponent: string;
  competition: string;
  stage?: string;
  venue?: string;
  score?: string;
  /** Starting XI (11 players). */
  lineup: LineupPlayer[];
}

export interface PlayerRecord {
  /** canonical key = normalized display name */
  name: string;
  fullName?: string;
  photo?: string;
  /** matched Wikipedia/Wikidata entity, when one was found */
  wiki?: string;
  attribution?: string;
}
