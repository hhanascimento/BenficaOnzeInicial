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
 * Returns true when `guess` identifies `target`.
 * Accepts the full name, a multi-part name ("di maria"), or a single surname/token when it
 * unambiguously refers to that one player. Matches whole words only, so "silva" never
 * matches "silvares".
 */
export function matchesPlayer(guess: string, target: string, allNames: string[]): boolean {
  const gNorm = normalize(guess);
  const tNorm = normalize(target);
  if (!gNorm || !tNorm) return false;
  if (gNorm === tNorm) return true;

  const contained =
    tNorm.startsWith(`${gNorm} `) ||
    tNorm.endsWith(` ${gNorm}`) ||
    tNorm.includes(` ${gNorm} `);
  if (!contained) return false;

  const gTokens = gNorm.split(' ');
  // A full or multi-part name is specific enough on its own.
  if (gTokens.length > 1) return true;

  // A lone token (usually a surname) counts only when no *other* player shares it.
  // Names that are themselves short forms of this same player (e.g. the squad list
  // stores both "Grimaldo" and "Alejandro Grimaldo") are not competition.
  const [token] = gTokens;
  const tTokens = tokens(target);
  const ambiguous = allNames.some((n) => {
    const nNorm = normalize(n);
    if (nNorm === tNorm) return false;
    const nTokens = tokens(n);
    if (!nTokens.includes(token)) return false;
    return !nTokens.every((t) => tTokens.includes(t));
  });
  return !ambiguous;
}
