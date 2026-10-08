import type { LineupPlayer } from '../types';
import './PlayerSlot.css';

interface Props {
  player: LineupPlayer;
  revealed: boolean;
  justRevealed?: boolean;
  /** Show the player's first initial in the empty slot. */
  hint?: boolean;
  /** This is the slot the player last looked at. */
  active?: boolean;
  onClick?: () => void;
}

export default function PlayerSlot({
  player,
  revealed,
  justRevealed,
  hint,
  active,
  onClick,
}: Props) {
  const initials = player.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  return (
    <div
      className={`slot ${revealed ? 'slot--revealed' : 'slot--hidden'} ${
        justRevealed ? 'slot--pop' : ''
      }`}
      style={{ left: `${player.x}%`, top: `${100 - player.y}%` }}
      data-testid={`slot-${player.name}`}
    >
      {revealed ? (
        <button
          type="button"
          className="slot__tap"
          onClick={onClick}
          aria-label={`${player.name}, ${player.position}`}
        >
          <span className={`slot__photo ${active ? 'slot__photo--active' : ''}`}>
            {player.photo ? (
              <img src={player.photo} alt={player.name} loading="lazy" />
            ) : (
              <span className="slot__initials">{initials}</span>
            )}
          </span>
          <span className="slot__name">{player.name}</span>
        </button>
      ) : (
        <div className="slot__placeholder" title={hint ? 'Hint: first letter' : 'Unknown player'}>
          <span>{player.position}</span>
          {hint && <em className="slot__hint">{player.name[0].toUpperCase()}</em>}
        </div>
      )}
    </div>
  );
}
