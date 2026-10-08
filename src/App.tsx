import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonApp, IonContent, IonHeader, IonToolbar, IonTitle, IonButton,
  IonInput, IonBadge, IonChip, IonIcon, IonProgressBar, IonFooter,
} from '@ionic/react';
import {
  football, refresh, eye, checkmarkCircle, closeCircle, timerOutline,
  flame, trophy, bulb, star, flash, lockClosed, close, informationCircle,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';
import type { Match } from './types';
import matchesData from './data/matches.json';
import Pitch from './components/Pitch';
import Summary from './components/Summary';
import Credits from './components/Credits';
import { matchesPlayer, normalize } from './lib/text';
import {
  loadSettings, saveSettings, loadStats, saveStats,
  playerFrequency, maxAverageFrequency, matchDifficulty,
  scoreRound, applyResult, formatTime,
} from './lib/game';
import type { Settings, Stats, RoundResult } from './lib/game';
import './App.css';

addIcons({
  football, refresh, eye, checkmarkCircle, closeCircle, timerOutline,
  flame, trophy, bulb, star, flash, lockClosed, close, informationCircle,
});

const MATCHES = matchesData as unknown as Match[];

/** Every player who appears anywhere in the dataset – used for suggestions and uniqueness. */
const POOL = Array.from(new Set(MATCHES.flatMap((m) => m.lineup.map((p) => p.name)))).sort();

/* Difficulty is dataset-wide, so it is computed once. */
const FREQ = playerFrequency(MATCHES);
const MAX_AVG = maxAverageFrequency(MATCHES, FREQ);

type Msg = { text: string; kind: 'ok' | 'bad' | 'info' };

const SETTING_LABELS: { key: keyof Settings; label: string; icon: string; hint: string }[] = [
  { key: 'hints', label: 'Hints', icon: bulb, hint: 'Show each player’s first initial' },
  { key: 'blind', label: 'Blind match', icon: lockClosed, hint: 'Hide the score and date' },
  { key: 'hard', label: 'Hard', icon: flash, hint: 'No autocomplete suggestions' },
];

export default function App() {
  const [index, setIndex] = useState(0);
  const match = MATCHES[index];

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
    if (settings.hard || q.length < 2 || finished) return [];
    return POOL.filter((n) => normalize(n).startsWith(q) || normalize(n).includes(q)).slice(0, 6);
  }, [guess, finished, settings.hard]);

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
    setIndex((i) => (i + 1) % MATCHES.length);
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
      (p, i) => !revealed.has(i) && matchesPlayer(value, p.name, POOL),
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
        ? { text: `${value} already found or not in this XI.`, kind: 'info' }
        : { text: `Not a Benfica player in the database: “${value}”.`, kind: 'bad' },
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
      if (activeIdx >= 0 && suggestions[activeIdx]) submitGuess(suggestions[activeIdx]);
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

  const showScore = !settings.blind || finished;

  const dateLabel = new Date(match.date + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <IonApp>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonIcon icon={football} /> Benfica XI
            <span className="titleCount"> {index + 1}/{MATCHES.length}</span>
          </IonTitle>
          <div className="hud" slot="end">
            <span className="hud__item" title="Win streak"><IonIcon icon={flame} />{stats.streak}</span>
            <span className="hud__item" title="Total score"><IonIcon icon={trophy} />{stats.totalScore}</span>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="game">
        <div className="pitchWrap">
          <section className="match card" data-testid="match-info">
            <h2>
              {match.home ? 'Benfica' : match.opponent}
              {showScore ? (
                match.score ? <span className="score"> {match.score} </span> : ' vs '
              ) : (
                <span className="score"> ? – ? </span>
              )}
              {match.home ? match.opponent : 'Benfica'}
            </h2>
            <p className="meta">
              <IonBadge color="primary">{match.competition}</IonBadge>
              {match.stage && <IonBadge color="medium">{match.stage}</IonBadge>}
              <span>{settings.blind && !finished ? 'Date hidden' : dateLabel}</span>
              <span>·</span>
              <span>{match.home ? 'Home' : 'Away'}</span>
              {match.venue && <span>· {match.venue}</span>}
            </p>
            <p className="stars" title={`Difficulty ${difficulty}/5`} data-testid="difficulty">
              {[1, 2, 3, 4, 5].map((n) => (
                <IonIcon key={n} icon={star} className={n <= difficulty ? 'on' : 'off'} />
              ))}
            </p>
          </section>

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
                    <>Players found: {revealed.size}/{match.lineup.length}</>
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
                      placeholder={settings.hard ? 'Recall a name…' : 'Type a player name…'}
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
                        aria-label="Clear input"
                        data-testid="clear-guess"
                        onClick={() => { setGuess(''); setActiveIdx(-1); }}
                      >
                        <IonIcon icon={closeCircle} />
                      </button>
                    )}
                    {suggestions.length > 0 && (
                      <ul className="suggest" data-testid="suggestions">
                        {suggestions.map((n, i) => (
                          <li key={n}>
                            <button
                              type="button"
                              className={i === activeIdx ? 'is-active' : ''}
                              onMouseEnter={() => setActiveIdx(i)}
                              onClick={() => submitGuess(n)}
                            >
                              {n}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <IonButton data-testid="guess-button" onClick={() => submitGuess(guess)}>
                    Guess
                  </IonButton>
                </div>

                {message && <p className={`msg msg--${message.kind}`} data-testid="message">{message.text}</p>}

                {foundNames.length > 0 && (
                  <div className="found">
                    {foundNames.map((n) => <IonChip key={n} color="primary" outline>{n}</IonChip>)}
                  </div>
                )}
              </>
            )}

            <div className="actions">
              <IonButton fill="outline" size="small" onClick={resetRound}>
                <IonIcon slot="start" icon={refresh} /> Reset
              </IonButton>
              <IonButton fill="outline" size="small" color="medium" onClick={giveUp} disabled={finished}>
                <IonIcon slot="start" icon={eye} /> Reveal
              </IonButton>
              <IonButton fill="solid" size="small" onClick={nextMatch}>
                Next match
              </IonButton>
            </div>
          </section>
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <p className="footer">
            {MATCHES.length} historic matches · solved {stats.solved}/{stats.played} ·
            best streak {stats.bestStreak}
            <button
              type="button"
              className="footerLink"
              data-testid="open-credits"
              onClick={() => setCreditsOpen(true)}
            >
              <IonIcon icon={informationCircle} /> photo credits
            </button>
          </p>
        </IonToolbar>
      </IonFooter>

      <Credits isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </IonApp>
  );
}
