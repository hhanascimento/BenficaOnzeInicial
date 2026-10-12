import { useState } from 'react';
import type { LineupPlayer } from '../types';
import { slotLeft } from '../lib/pitch';
import { initialsFor } from '../lib/text';
import './PlayerSlot.css';

interface Props {
  player: LineupPlayer;
  revealed: boolean;
  justRevealed?: boolean;
  /** Show the player's initials in the empty slot. */
  hintInitials?: boolean;
  /** Show the player's shirt number in the empty slot. */
  hintNumber?: boolean;
  /** This is the slot the player last looked at. */
  active?: boolean;
  onClick?: () => void;
}

export default function PlayerSlot({
  player,
  revealed,
  justRevealed,
  hintInitials,
  hintNumber,
  active,
  onClick,
}: Props) {
  /* The dataset can reference a photo that is not in the repo (a slug with no
     file next to it). A broken image icon would spoil the pitch, so a failed
     load falls back to the initials, exactly like a player with no photo. */
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!player.photo && !photoFailed;

  /* First + last initial ("Cristóvão" → "HC", "Costa Pereira" → "CP"). The
     same initials serve the hint badge and the no-photo fallback, so a slot
     never changes its letters when it is revealed. */
  const initials = initialsFor(player);

  /* The shirt-number hint only exists for the players whose record carries a
     number (88% of the dataset): the rest simply show nothing for that hint. */
  const showNumber = hintNumber && player.number != null;

  const hintTitle = hintInitials && showNumber
    ? 'Dicas: iniciais e número de camisola'
    : hintInitials
      ? 'Dica: iniciais do jogador'
      : showNumber
        ? 'Dica: número de camisola'
        : 'Jogador desconhecido';

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
        <div className="slot__placeholder" title={hintTitle}>
          <span>{player.position}</span>
          {hintInitials && <em className="slot__hint slot__hint--initials">{initials}</em>}
          {showNumber && <em className="slot__hint slot__hint--number">{player.number}</em>}
        </div>
      )}
    </div>
  );
}
