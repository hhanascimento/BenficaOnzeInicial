import { useMemo, useState } from 'react';
import { IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBack, calendar, play } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import type { Match } from '../types';
import matchesData from '../data/matches.json';
import {
  ERA_PRESETS, loadEra, matchesInRange, yearBounds,
} from '../lib/game';
import type { EraRange } from '../lib/game';
import './EraSelect.css';

addIcons({ arrowBack, calendar, play });

const MATCHES = matchesData as unknown as Match[];
const BOUNDS = yearBounds(MATCHES);
/** The whole dataset, i.e. the "Todas as épocas" option. */
const ALL: EraRange = { from: BOUNDS.from, to: BOUNDS.to };

const countIn = (from: number, to: number) => matchesInRange(MATCHES, from, to).length;
const sameRange = (a: EraRange, b: EraRange) => a.from === b.from && a.to === b.to;

interface Props {
  /** Return to the intro screen without starting a game. */
  onBack: () => void;
  /** Start a game drawn from the chosen period. */
  onStart: (era: EraRange) => void;
}

/**
 * The screen shown before every game: which period should the XI come from?
 * Seven decades plus the whole history, or a handpicked year range. The last
 * choice is remembered and highlighted, but the picker is always shown, so a
 * new game always starts from a deliberate choice.
 */
export default function EraSelect({ onBack, onStart }: Props) {
  const [last] = useState<EraRange | null>(() => loadEra());
  const [fromText, setFromText] = useState(() => String(last?.from ?? BOUNDS.from));
  const [toText, setToText] = useState(() => String(last?.to ?? BOUNDS.to));

  const from = Number.parseInt(fromText, 10);
  const to = Number.parseInt(toText, 10);
  const wellFormed = Number.isFinite(from) && Number.isFinite(to) && from <= to;
  const customCount = useMemo(
    () => (wellFormed ? countIn(from, to) : 0),
    [wellFormed, from, to],
  );

  const customIsLast = last != null && !ERA_PRESETS.some((p) => sameRange(p, last)) && !sameRange(last, ALL);

  function start(range: EraRange) {
    onStart(range);
  }

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <button
            type="button"
            slot="start"
            className="newGame homeBtn"
            data-testid="era-back"
            title="Voltar ao ecrã inicial"
            aria-label="Voltar ao ecrã inicial"
            onClick={onBack}
          >
            <IonIcon icon={arrowBack} />
          </button>
          <IonTitle>Novo Jogo</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="eraScreen">
        <div className="era" data-testid="era-select">
          <h1 className="era__title">
            <IonIcon icon={calendar} /> Escolhe a época
          </h1>
          <p className="era__lead">
            De que período queres o onze inicial? Escolhe uma década ou define o teu próprio
            intervalo de anos.
          </p>

          <div className="era__grid" role="group" aria-label="Décadas">
            <button
              type="button"
              data-testid="era-all"
              className={`era__option ${last && sameRange(last, ALL) ? 'is-active' : ''}`}
              onClick={() => start(ALL)}
            >
              <span className="era__option-label">Todas as épocas</span>
              <span className="era__option-count">{countIn(ALL.from, ALL.to)} jogos</span>
            </button>

            {ERA_PRESETS.map((preset) => {
              const count = countIn(preset.from, preset.to);
              return (
                <button
                  key={preset.label}
                  type="button"
                  data-testid={`era-${preset.from}`}
                  disabled={count === 0}
                  className={`era__option ${last && sameRange(last, preset) ? 'is-active' : ''}`}
                  onClick={() => start({ from: preset.from, to: preset.to })}
                >
                  <span className="era__option-label">{preset.label}</span>
                  <span className="era__option-count">{count} jogos</span>
                </button>
              );
            })}
          </div>

          <h2 className="era__head">Ou um intervalo à medida</h2>
          <div className={`era__custom ${customIsLast ? 'is-active' : ''}`}>
            <label className="era__field">
              <span>Ano inicial</span>
              <input
                type="number"
                inputMode="numeric"
                data-testid="era-custom-from"
                min={BOUNDS.from}
                max={BOUNDS.to}
                value={fromText}
                onChange={(e) => setFromText(e.target.value)}
              />
            </label>
            <span className="era__dash" aria-hidden>–</span>
            <label className="era__field">
              <span>Ano final</span>
              <input
                type="number"
                inputMode="numeric"
                data-testid="era-custom-to"
                min={BOUNDS.from}
                max={BOUNDS.to}
                value={toText}
                onChange={(e) => setToText(e.target.value)}
              />
            </label>
          </div>

          <p className={`era__count ${wellFormed && customCount > 0 ? '' : 'era__count--empty'}`}>
            {wellFormed
              ? customCount > 0
                ? `${customCount} ${customCount === 1 ? 'jogo' : 'jogos'} entre ${from} e ${to}`
                : 'Não há jogos neste intervalo.'
              : 'O ano inicial tem de ser anterior ao final.'}
          </p>

          <IonButton
            expand="block"
            data-testid="era-start"
            disabled={!wellFormed || customCount === 0}
            onClick={() => start({ from, to })}
          >
            <IonIcon slot="start" icon={play} /> Começar
          </IonButton>

          <p className="era__note">
            Os jogos do intervalo são baralhados e não se repetem até teres passado por todos.
          </p>
        </div>
      </IonContent>
    </>
  );
}
