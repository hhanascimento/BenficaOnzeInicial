/**
 * Position as printed on the slot. Two vocabularies are in use: the English
 * codes of the original dataset and the general Portuguese roles the localized
 * dataset carries (GR = guarda-redes, DF = defesa, MC = meio-campista,
 * AV = avançado), so both spellings are valid.
 */
export type PositionCode =
  | 'GK'
  | 'RB' | 'CB' | 'LB'
  | 'DM' | 'CM' | 'AM'
  | 'RW' | 'LW' | 'ST'
  | 'GR' | 'DF' | 'MC' | 'AV';

export interface LineupPlayer {
  /** Display name, short form used in the game (e.g. "Coluna"). */
  name: string;
  /** Full name as recorded in the source (e.g. "Mário Coluna"). */
  fullName?: string;
  position: PositionCode;
  /**
   * Source pitch coordinates: y runs 0 (own goal-line) to 100 (opponent's),
   * x is on an 80-unit-wide grid (the source pitch is 80 wide x 100 tall and
   * every XI is symmetric about x = 40). PlayerSlot maps x onto the full width.
   */
  x: number;
  y: number;
  /** Path to the photo, relative to the app base (e.g. "assets/players/eusebio.jpg"). */
  photo?: string;
  /** Optional shirt number. */
  number?: number;
  /**
   * Source page slug (e.g. "alejandro-grimaldo", "joao-manuel-pinto"). It is
   * not shown during play: `buildPool` turns it into an alternate name so a
   * first + last name guess also identifies the player.
   */
  slug?: string;
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
