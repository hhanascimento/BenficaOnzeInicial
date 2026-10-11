import { useState } from 'react';
import { IonApp } from '@ionic/react';
import Home from './components/Home';
import Help from './components/Help';
import Game from './components/Game';

/**
 * The app shell. Three screens, one at a time:
 *
 *   home  – the intro screen: the club crest plus "Jogar" / "Instruções"
 *   game  – the pitch game (one historic XI per round)
 *   help  – how the game works
 *
 * Only one screen is mounted at a time, so leaving the pitch stops its clock
 * and the home screen never shows a stale round.
 */
type Screen = 'home' | 'game' | 'help';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <IonApp>
      {screen === 'home' && (
        <Home onPlay={() => setScreen('game')} onHelp={() => setScreen('help')} />
      )}
      {screen === 'help' && <Help onBack={() => setScreen('home')} />}
      {screen === 'game' && <Game onHome={() => setScreen('home')} />}
    </IonApp>
  );
}
