import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonApp, IonContent, IonHeader, IonToolbar, IonTitle, IonButton,
  IonInput, IonBadge, IonChip, IonIcon, IonProgressBar, IonFooter,
} from '@ionic/react';
import {
  football, refresh, eye, checkmarkCircle, closeCircle, timerOutline,
  flame, trophy, bulb, star, close, informationCircle, shuffle,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';
import type { LineupPlayer, Match } from './types';
import matchesData from './data/matches.json';
import Pitch from './components/Pitch';
import Summary from './components/Summary';
import Credits from './components/Credits';
import {
  aliasHit, buildPool, knownFrom, matchesPlayer, matchesQuery, normalize,
} from './lib/text';
import type { KnownPlayer } from './lib/text';
import {
  loadSettings, saveSettings, loadStats, saveStats,
  playerFrequency, maxAverageFrequency, matchDifficulty,
  scoreRound, applyResult, formatTime, formatDate, shuffleDeck,
} from './lib/game';
import type { Settings, Stats, RoundResult } from './lib/game';
import './App.css';

addIcons({
  football, refresh, eye, checkmarkCircle, closeCircle, timerOutline,
  flame, trophy, bulb, star, close, informationCircle, shuffle,
});

const MATCHES = matchesData as unknown as Match[];

/**
 * Every player who appears anywhere in the dataset – used for suggestions and
 * uniqueness. Each entry also carries the alternate name its slug holds, so a
 * first + last name finds a slot that is shown as a surname alone.
 */
const POOL: KnownPlayer[] = buildPool(MATCHES);

/**
 * The name rules for one player on the pitch. The alias comes from that
 * player's own slug (see `knownFrom`), so two different players who share a
 * display name in the dataset ("Martins", "Silva") keep their own first name.
 */
const knownOf = (p: LineupPlayer): KnownPlayer => knownFrom(p);

/* Difficulty is dataset-wide, so it is computed once. */
const FREQ = playerFrequency(MATCHES);
const MAX_AVG = maxAverageFrequency(MATCHES, FREQ);

type Msg = { text: string; kind: 'ok' | 'bad' | 'info' };

const SETTING_LABELS: { key: keyof Settings; label: string; icon: string; hint: string }[] = [
  { key: 'hints', label: 'Dicas', icon: bulb, hint: 'Mostra a inicial de cada jogador' },
];

export default function App() {
  const [deck, setDeck] = useState(() => shuffleDeck(MATCHES.length, -1));
  const [index, setIndex] = useState(0);
  const match = MATCHES[deck[index]];

  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [lastRevealed, setLastRevealed] = useState<number | null>(null);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState<Msg | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [shake, setShake] = useState(false);

  const [seconds, setSeconds] = useState(0);
  const [usedReveal, setUsedReveal] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);

  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [creditsOpen, setCreditsOpen] = useState(false);

  const secondsRef = useRef(0);
  const recordedRef = useRef(false);

  const difficulty = useMemo(() => matchDifficulty(match, FREQ, MAX_AVG), [match]);

  const solved = revealed.size === match.lineup.length;
  const finished = solved || usedReveal;

  /* ---- timer: runs until the round ends, restarts on every new match ---- */
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [finished, index]);

  /* ---- score the round exactly once, when it ends ---- */
  useEffect(() => {
    if (!finished || recordedRef.current) return;
    recordedRef.current = true;
    const res = scoreRound({
      total: match.lineup.length,
      revealed: revealed.size,
      seconds: secondsRef.current,
      difficulty,
      usedReveal,
      hintsOn: settings.hints,
    });
    setResult(res);
    setStats((prev) => {
      const next = applyResult(prev, res);
      saveStats(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const suggestions = useMemo(() => {
    const q = normalize(guess);
    if (q.length < 2 || finished) return [];
    return POOL.filter((n) => matchesQuery(n, q)).slice(0, 6);
  }, [guess, finished]);

  const foundNames = useMemo(
    () => match.lineup.filter((_, i) => revealed.has(i)).map((p) => p.name),
    [match, revealed],
  );

  useEffect(() => { setActiveIdx(-1); }, [guess]);

  function resetRound() {
    secondsRef.current = 0;
    recordedRef.current = false;
    setRevealed(new Set());
    setLastRevealed(null);
    setGuess('');
    setMessage(null);
    setActiveIdx(-1);
    setSeconds(0);
    setUsedReveal(false);
    setResult(null);
    setShake(false);
  }

  function nextMatch() {
    if (index + 1 < deck.length) {
      setIndex(index + 1);
    } else {
      // every match has been played once – start a fresh shuffled pass
      setDeck(shuffleDeck(MATCHES.length, deck[deck.length - 1]));
      setIndex(0);
    }
    resetRound();
  }

  /** Skip straight to a new game: reshuffle and start on a different match. */
  function newGame() {
    setDeck(shuffleDeck(MATCHES.length, deck[index]));
    setIndex(0);
    resetRound();
  }

  function toggle(key: keyof Settings) {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSettings(next);
      return next;
    });
  }

  function flashShake() {
    setShake(true);
    window.setTimeout(() => setShake(false), 460);
  }

  function submitGuess(value: string) {
    value = value.trim();
    if (!value) return;

    const target = match.lineup.findIndex(
      (p, i) => !revealed.has(i) && matchesPlayer(value, knownOf(p), POOL),
    );

    if (target >= 0) {
      const player = match.lineup[target];
      const next = new Set(revealed);
      next.add(target);
      setRevealed(next);
      setLastRevealed(target);
      setGuess('');
      setMessage({ text: `${player.name} ✓ — ${next.size}/${match.lineup.length}`, kind: 'ok' });
      return;
    }

    const inPool = POOL.some((n) => matchesPlayer(value, n, POOL));
    setMessage(
      inPool
        ? { text: `${value} já foi encontrado ou não está neste onze.`, kind: 'info' }
        : { text: `Não é um jogador do Benfica na base de dados: “${value}”.`, kind: 'bad' },
    );
    setGuess('');
    flashShake();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) submitGuess(suggestions[activeIdx].name);
      else submitGuess(guess);
    } else if (e.key === 'Escape') {
      setActiveIdx(-1);
    }
  }

  function giveUp() {
    setRevealed(new Set(match.lineup.map((_, i) => i)));
    setLastRevealed(null);
    setUsedReveal(true);
    setMessage(null);
  }


  const dateLabel = formatDate(match.date);

  return (
    <IonApp>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            Benfica Onze Inicial
            <span className="titleCount"> {index + 1}/{MATCHES.length}</span>
          </IonTitle>
          <div className="hud" slot="end">
            <button
              type="button"
              className="newGame"
              data-testid="new-game"
              title="Sorteia um jogo novo"
              aria-label="Novo Jogo"
              onClick={newGame}
            >
              <IonIcon icon={shuffle} />
              <span className="newGame__label">Novo Jogo</span>
            </button>
            <span className="hud__item" title="Sequência de vitórias"><IonIcon icon={flame} />{stats.streak}</span>
            <span className="hud__item" title="Pontuação total"><IonIcon icon={trophy} />{stats.totalScore}</span>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="game">
        <div className="pitchWrap">
          {/* Once the round is over the summary carries the fixture, so the
              card and the mode toggles step aside and give the height to the
              pitch (see Summary.tsx). */}
          {!finished && (
          <section className="match card" data-testid="match-info">
            <h2>
              {match.home ? 'Benfica' : match.opponent}
              {match.score ? <span className="score"> {match.score} </span> : ' vs '}
              {match.home ? match.opponent : 'Benfica'}
            </h2>
            <p className="meta">
              <IonBadge color="primary">{match.competition}</IonBadge>
              {match.stage && <IonBadge color="medium">{match.stage}</IonBadge>}
              <span>{dateLabel}</span>
              <span>·</span>
              <span>{match.home ? 'Casa' : 'Fora'}</span>
              {match.venue && <span className="meta__venue">· {match.venue}</span>}
            </p>
            <p className="stars" title={`Dificuldade ${difficulty}/5`} data-testid="difficulty">
              {[1, 2, 3, 4, 5].map((n) => (
                <IonIcon key={n} icon={star} className={n <= difficulty ? 'on' : 'off'} />
              ))}
            </p>
          </section>
          )}

          {/* the mode toggles step aside in the recap so the pitch keeps its height */}
          {!finished && (
          <div className="settings" data-testid="settings">
            {SETTING_LABELS.map(({ key, label, icon, hint }) => (
              <button
                key={key}
                type="button"
                title={hint}
                className={`toggle ${settings[key] ? 'toggle--on' : ''}`}
                data-testid={`toggle-${key}`}
                aria-pressed={settings[key]}
                onClick={() => toggle(key)}
              >
                <IonIcon icon={icon} /> {label}
              </button>
            ))}
          </div>
          )}

          <div className="pitchStage">
            <Pitch
              lineup={match.lineup}
              revealed={revealed}
              lastRevealed={lastRevealed}
              home={match.home}
              hints={settings.hints && !finished}
              onSlotClick={(i) => {
                if (revealed.has(i)) setLastRevealed(i);
              }}
            />
          </div>

          <section className="card controls">
            <div className="statbar">
              <IonProgressBar value={revealed.size / match.lineup.length} color="primary" />
              <div className="statbar__row">
                <span className={`timer ${finished ? 'timer--done' : ''}`} data-testid="timer">
                  <IonIcon icon={timerOutline} /> {formatTime(seconds)}
                </span>
                <span className="statbar__count">
                  {finished ? (
                    <strong className="solved"><IonIcon icon={checkmarkCircle} /> {revealed.size}/{match.lineup.length}</strong>
                  ) : (
                    <>Jogadores Encontrados: {revealed.size}/{match.lineup.length}</>
                  )}
                </span>
              </div>
            </div>

            {finished && result ? (
              <Summary
                match={match}
                result={result}
                seconds={seconds}
                difficulty={difficulty}
                streak={stats.streak}
                usedReveal={usedReveal}
                revealed={revealed.size}
                onNext={nextMatch}
                onReplay={resetRound}
              />
            ) : (
              <>
                <div className="guessRow">
                  <div className={`guessField ${shake ? 'guessField--shake' : ''}`}>
                    <IonInput
                      className="guessInput"
                      data-testid="guess-input"
                      placeholder="Escreve o nome do jogador…"
                      value={guess}
                      autocapitalize="words"
                      enterkeyhint="done"
                      onIonInput={(e) => setGuess((e.detail.value ?? '') as string)}
                      onKeyDown={onKeyDown}
                    />
                    {guess && (
                      <button
                        type="button"
                        className="guessClear"
                        aria-label="Limpar campo"
                        data-testid="clear-guess"
                        onClick={() => { setGuess(''); setActiveIdx(-1); }}
                      >
                        <IonIcon icon={closeCircle} />
                      </button>
                    )}
                    {suggestions.length > 0 && (
                      <ul className="suggest" data-testid="suggestions">
                        {suggestions.map((p, i) => {
                          // when the hit comes from the slug's fuller name, say so –
                          // otherwise the list looks like it is offering a stranger
                          const alias = aliasHit(p, guess);
                          return (
                            <li key={p.name}>
                              <button
                                type="button"
                                data-name={p.name}
                                className={i === activeIdx ? 'is-active' : ''}
                                onMouseEnter={() => setActiveIdx(i)}
                                onClick={() => submitGuess(p.name)}
                              >
                                <span className="suggest__name">{p.name}</span>
                                {alias && <span className="suggest__alias">{alias}</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <IonButton data-testid="guess-button" onClick={() => submitGuess(guess)}>
                    Adivinha
                  </IonButton>
                </div>

                <div className="feedback">
                  {message ? (
                    <p className={`msg msg--${message.kind}`} data-testid="message">{message.text}</p>
                  ) : (
                    <p className="msg msg--hint" data-testid="hint">
                      Escreve um nome e carrega em Adivinha
                    </p>
                  )}

                  {foundNames.length > 0 && (
                    <div className="found">
                      {foundNames.map((n) => <IonChip key={n} color="primary" outline>{n}</IonChip>)}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* The summary carries its own controls, so this row is only for the
                round in progress – it also frees ~50px of height for the pitch. */}
            {!finished && (
              <div className="actions">
                <IonButton fill="outline" size="small" onClick={resetRound}>
                  <IonIcon slot="start" icon={refresh} /> Reiniciar
                </IonButton>
                <IonButton fill="outline" size="small" color="medium" data-testid="give-up" onClick={giveUp} disabled={finished}>
                  <IonIcon slot="start" icon={eye} /> Resolve
                </IonButton>
                <IonButton fill="solid" size="small" onClick={nextMatch}>
                  Próximo Jogo
                </IonButton>
              </div>
            )}
          </section>
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <p className="footer">
            {MATCHES.length} jogos históricos · resolvidos {stats.solved}/{stats.played} ·
            melhor sequência {stats.bestStreak}
            <button
              type="button"
              className="footerLink"
              data-testid="open-credits"
              onClick={() => setCreditsOpen(true)}
            >
              <IonIcon icon={informationCircle} /> créditos das fotos
            </button>
          </p>
        </IonToolbar>
      </IonFooter>

      <Credits isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </IonApp>
  );
}
