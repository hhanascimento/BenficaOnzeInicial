import { IonButton, IonContent, IonIcon } from '@ionic/react';
import { helpCircle, play } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { loadStats } from '../lib/game';
import './Home.css';

addIcons({ play, helpCircle });

interface Props {
  /** Start the pitch game. */
  onPlay: () => void;
  /** Open the "how to play" screen. */
  onHelp: () => void;
}

/** The intro screen: the app logo (crest + wordmark), the promise of the game and
 *  the two ways in. The logo carries the name, so the <h1> is text for screen
 *  readers only and is not repeated on screen. */
export default function Home({ onPlay, onHelp }: Props) {
  const stats = loadStats();

  return (
    <IonContent className="homeScreen">
      <div className="home">
        <img className="home__logo" src="assets/benfica-logo.svg" alt="" />
        <h1 className="home__srTitle">Benfica Onze Inicial</h1>
        <p className="home__tagline">
          Adivinha o onze inicial do Benfica em jogos históricos — de 1961 aos dias de hoje.
        </p>

        <div className="home__actions">
          <IonButton expand="block" size="large" data-testid="play" onClick={onPlay}>
            <IonIcon slot="start" icon={play} /> Jogar
          </IonButton>
          <IonButton
            expand="block"
            size="large"
            fill="outline"
            color="medium"
            data-testid="help"
            onClick={onHelp}
          >
            <IonIcon slot="start" icon={helpCircle} /> Instruções
          </IonButton>
        </div>

        {stats.played > 0 && (
          <p className="home__stats">
            {stats.solved}/{stats.played} onzes resolvidos · melhor sequência {stats.bestStreak} ·{' '}
            {stats.totalScore} pontos
          </p>
        )}
      </div>
    </IonContent>
  );
}
