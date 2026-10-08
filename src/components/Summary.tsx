import { IonButton, IonIcon } from '@ionic/react';
import { trophy, timerOutline, star, flame, refresh } from 'ionicons/icons';
import type { RoundResult } from '../lib/game';
import { formatTime } from '../lib/game';
import type { Match } from '../types';
import './Summary.css';

interface Props {
  match: Match;
  result: RoundResult;
  seconds: number;
  difficulty: number;
  streak: number;
  usedReveal: boolean;
  revealed: number;
  onNext: () => void;
  onReplay: () => void;
}

export default function Summary({
  match, result, seconds, difficulty, streak, usedReveal, revealed, onNext, onReplay,
}: Props) {
  const headline = usedReveal ? 'Onze revelado' : result.solved ? 'Onze completo!' : 'Round over';
  const scoreLabel = result.solved ? 'Perfeito' : 'Complicado';

  return (
    <div className="summary" data-testid="summary">
      <p className="summary__head">
        <IonIcon icon={trophy} /> {headline}
      </p>
      <p className="summary__sub">
        {scoreLabel} · {match.home ? 'Benfica' : match.opponent} {match.score ? match.score : 'vs'}
        {' '}
        {match.home ? match.opponent : 'Benfica'}
      </p>

      <div className="summary__grid">
        <div className="summary__cell">
          <IonIcon icon={trophy} />
          <strong>{result.points}</strong>
          <span>pontos</span>
        </div>
        <div className="summary__cell">
          <IonIcon icon={timerOutline} />
          <strong>{formatTime(seconds)}</strong>
          <span>tempo</span>
        </div>
        <div className="summary__cell">
          <IonIcon icon={star} />
          <strong>{difficulty}/5</strong>
          <span>dificuldade</span>
        </div>
        <div className="summary__cell">
          <IonIcon icon={flame} />
          <strong>{streak}</strong>
          <span>sequência</span>
        </div>
      </div>

      <ul className="summary__breakdown">
        <li><span>Jogadores encontrados</span><b>{revealed}/{match.lineup.length}</b></li>
        <li><span>Score</span><b>{result.base}</b></li>
        <li><span>Bonus</span><b>+{result.timeBonus}</b></li>
        <li><span>Multiplicador Dificuldade</span><b>×{result.multiplier.toFixed(1)}</b></li>
        {result.hintPenalty > 0 && (
          <li className="summary__penalty"><span>Hints used</span><b>−{result.hintPenalty}</b></li>
        )}
      </ul>

      <div className="summary__actions">
        <IonButton fill="outline" size="small" color="medium" onClick={onReplay}>
          <IonIcon slot="start" icon={refresh} /> Repetir
        </IonButton>
        <IonButton size="small" onClick={onNext}>Próximo Jogo</IonButton>
      </div>
    </div>
  );
}
