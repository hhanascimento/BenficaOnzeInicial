import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon,
  IonContent, IonList, IonItem, IonLabel, IonNote, IonSearchbar,
} from '@ionic/react';
import { close } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import creditsData from '../data/credits.json';
import './Credits.css';

interface Credit {
  name: string;
  source: string;
}

const CREDITS = creditsData as unknown as { _note: string; players: Record<string, Credit> };

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Lists the provenance of every downloaded player photo (licensing/attribution). */
export default function Credits({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState('');

  const entries = useMemo(
    () =>
      Object.entries(CREDITS.players)
        .map(([slug, c]) => ({ slug, ...c }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.name.toLowerCase().includes(q) || e.slug.includes(q));
  }, [entries, query]);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} data-testid="credits-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Player photo credits</IonTitle>
          <IonButton slot="end" fill="clear" onClick={onClose} aria-label="Close">
            <IonIcon slot="icon-only" icon={close} />
          </IonButton>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={query}
            placeholder="Filter players"
            onIonInput={(e) => setQuery((e.detail.value ?? '') as string)}
          />
        </IonToolbar>
      </IonHeader>
      <IonContent className="credits">
        <p className="credits__note">{CREDITS._note}</p>
        <p className="credits__count">{shown.length} of {entries.length} photos</p>
        <IonList>
          {shown.map((e) => (
            <IonItem key={e.slug} href={e.source} target="_blank" rel="noreferrer">
              <IonLabel>
                <h3>{e.name}</h3>
                <IonNote>{e.slug}</IonNote>
              </IonLabel>
              <IonNote slot="end">source ↗</IonNote>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonModal>
  );
}
