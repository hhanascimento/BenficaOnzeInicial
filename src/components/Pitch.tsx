import type { LineupPlayer } from '../types';
import PlayerSlot from './PlayerSlot';
import './Pitch.css';

interface Props {
  lineup: LineupPlayer[];
  revealed: Set<number>;
  lastRevealed: number | null;
  home: boolean;
  hints?: boolean;
  onSlotClick?: (index: number) => void;
}

export default function Pitch({
  lineup,
  revealed,
  lastRevealed,
  home,
  hints,
  onSlotClick,
}: Props) {
  return (
    <div className={`pitch ${home ? 'pitch--home' : 'pitch--away'}`} data-testid="pitch">
      <div className="pitch__stripes" aria-hidden />
      <div className="pitch__midline" aria-hidden />
      <div className="pitch__circle" aria-hidden />
      <div className="pitch__box pitch__box--top" aria-hidden />
      <div className="pitch__box pitch__box--bottom" aria-hidden />
      <div className="pitch__end pitch__end--top">
      </div>
      <div className="pitch__end pitch__end--bottom">
      </div>

      {lineup.map((player, index) => (
        <PlayerSlot
          key={player.name + index}
          player={player}
          revealed={revealed.has(index)}
          justRevealed={lastRevealed === index}
          hint={hints}
          active={revealed.has(index) && lastRevealed === index}
          onClick={() => onSlotClick?.(index)}
        />
      ))}
    </div>
  );
}
