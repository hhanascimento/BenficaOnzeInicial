import { useState } from 'react';
import type { LineupPlayer } from '../types';
import { slotLeft } from '../lib/pitch';
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
  /* The dataset can reference a photo that is not in the repo (a slug with no
     file next to it). A broken image icon would spoil the pitch, so a failed
     load falls back to the initials, exactly like a player with no photo. */
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!player.photo && !photoFailed;

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
      style={{ left: `${slotLeft(player.x)}%`, top: `${100 - player.y}%` }}
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
            {showPhoto ? (
              <img
                src={player.photo}
                alt={player.name}
                loading="lazy"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <span className="slot__initials">{initials}</span>
            )}
          </span>
          <span className="slot__name">{player.name}</span>
        </button>
      ) : (
        <div className="slot__placeholder" title={hint ? 'Dica: primeira letra' : 'Jogador desconhecido'}>
          <span>{player.position}</span>
          {hint && <em className="slot__hint">{player.name[0].toUpperCase()}</em>}
        </div>
      )}
    </div>
  );
}
