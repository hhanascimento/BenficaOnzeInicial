/** Strip accents, punctuation and casing so guesses match regardless of typing style. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Common connectors to drop when comparing names ("de", "da", "dos", "van", ...). */
const STOPWORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'di', 'del', 'la', 'le', 'van', 'von']);

function tokens(name: string): string[] {
  return normalize(name)
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/**
 * A player as the game knows them: the short display name plus any alternate
 * spellings that also identify them. The alternates come from the dataset slug,
 * which is the source page slug and usually carries the first name the display
 * name leaves out ("Grimaldo" ← "alejandro-grimaldo").
 */
export interface KnownPlayer {
  /** Name shown during play (e.g. "Grimaldo"). */
  name: string;
  /** Other names that identify the same player (e.g. "Alejandro Grimaldo"). */
  aliases?: string[];
}

/** Every name that identifies `player`, display name first. */
export function namesFor(player: KnownPlayer): string[] {
  return [player.name, ...(player.aliases ?? [])];
}

/**
 * Readable name held in a dataset slug: "alejandro-grimaldo" →
 * "Alejandro Grimaldo", "joao-manuel-pinto" → "Joao Manuel Pinto". Slugs are
 * stored without accents, which is harmless because matching is
 * accent-insensitive anyway.
 */
export function nameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * The pool of known players for a set of matches: one entry per distinct
 * display name, each carrying the aliases its slug adds. 212 of the 373 names
 * in the current dataset gain an alias this way (e.g. "Grimaldo" also answers
 * to "Alejandro Grimaldo").
 */
export function buildPool(matches: { lineup: { name: string; slug?: string }[] }[]): KnownPlayer[] {
  const byName = new Map<string, KnownPlayer>();
  for (const m of matches) {
    for (const p of m.lineup) {
      const key = normalize(p.name);
      if (!key) continue;
      let known = byName.get(key);
      if (!known) {
        known = { name: p.name, aliases: [] };
        byName.set(key, known);
      }
      const alias = p.slug ? nameFromSlug(p.slug) : '';
      if (!alias || normalize(alias) === key) continue;
      known.aliases ??= [];
      if (!known.aliases.includes(alias)) known.aliases.push(alias);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The name rules for one player record, using that record's own slug. Two
 * different players can share a display name in the dataset ("Martins" is
 * three people), so a match must read the alias from the lineup entry it is
 * looking at rather than from the merged pool entry.
 */
export function knownFrom(player: { name: string; slug?: string }): KnownPlayer {
  const alias = player.slug ? nameFromSlug(player.slug) : '';
  return {
    name: player.name,
    aliases: alias && normalize(alias) !== normalize(player.name) ? [alias] : [],
  };
}

/**
 * Returns true when `guess` identifies `target`.
 *
 * Accepted: an exact name, the full name, any two of its words in any order
 * ("rui costa", "costa rui", "mehdi gonzalez"), a contiguous multi-part name
 * ("di maria"), or a lone surname when no other player in `pool` shares it. Names are the
 * display name plus the player's aliases, so a first + last name that only the
 * source slug carries ("alejandro grimaldo" for the slot shown as "Grimaldo")
 * works too. Matches whole words only, so "silva" never matches "silvares".
 */
export function matchesPlayer(guess: string, target: KnownPlayer, pool: KnownPlayer[]): boolean {
  const gNorm = normalize(guess);
  if (!gNorm) return false;
  const names = namesFor(target).map(normalize).filter(Boolean);
  if (names.length === 0) return false;

  // An exact name always identifies its player – display name or alias. Without
  // this, a player whose name is a single common word would be unreachable: the
  // slot shows "Nélson", but another player's slug ("nelson-semedo") puts that
  // word in the pool too, and the ambiguity rule below would refuse the guess
  // for the very player the slot names.
  if (names.includes(gNorm)) return true;

  // word for word: the whole name, or a contiguous phrase inside it
  const literal = names.some(
    (n) => n === gNorm || n.startsWith(`${gNorm} `) || n.endsWith(` ${gNorm}`) || n.includes(` ${gNorm} `),
  );

  // …or the guess is a selection of the player's name words in any order, which
  // is what lets a first + last name find a name with middle words in between
  const guessWords = tokens(guess);
  if (guessWords.length === 0) return false;
  const nameWords = new Set(names.flatMap(tokens));
  const everyWord = guessWords.every((w) => nameWords.has(w));

  if (!literal && !everyWord) return false;

  // A full or multi-part name is specific enough on its own.
  if (gNorm.split(' ').length > 1 || guessWords.length > 1) return true;

  // A lone word (usually a surname) counts only when no *other* player shares
  // it. Names that add nothing but words this same player already has (a short
  // and a long form of one player) are not competition.
  const [word] = guessWords;
  const ambiguous = pool.some((other) => {
    if (other === target) return false;
    if (normalize(other.name) === normalize(target.name)) return false;
    const otherWords = tokens(namesFor(other).join(' '));
    if (!otherWords.includes(word)) return false;
    return !otherWords.every((t) => nameWords.has(t));
  });
  return !ambiguous;
}

/** Does a partly typed query filter down to this one name? */
function queryHitsName(name: string, query: string): boolean {
  const qNorm = normalize(query);
  if (!qNorm) return false;
  // every word typed matches the start of one of the name's words, in any order
  const qWords = tokens(query);
  const words = tokens(name);
  if (qWords.length > 0 && qWords.every((q) => words.some((w) => w.startsWith(q)))) return true;
  // otherwise fall back to a plain substring, so mid-word typing still suggests
  return normalize(name).includes(qNorm);
}

/** Should this player show up in the suggestion list for what has been typed? */
export function matchesQuery(player: KnownPlayer, query: string): boolean {
  return namesFor(player).some((n) => queryHitsName(n, query));
}

/**
 * The alias that made a suggestion match, or null when the display name alone
 * explains it. Lets the list say *why* it is offering a name the player does
 * not literally contain.
 */
export function aliasHit(player: KnownPlayer, query: string): string | null {
  if (queryHitsName(player.name, query)) return null;
  return (player.aliases ?? []).find((a) => queryHitsName(a, query)) ?? null;
}
