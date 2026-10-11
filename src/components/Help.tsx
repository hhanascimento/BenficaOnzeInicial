import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/react';
import {
  arrowBack, bulb, calendar, eye, refresh, shuffle, timerOutline, trophy,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';
import './Help.css';

addIcons({ arrowBack, bulb, calendar, eye, refresh, shuffle, timerOutline, trophy });

interface Props {
  /** Return to the intro screen. */
  onBack: () => void;
}

const STEPS = [
  'Antes de cada jogo escolhe a época: uma década (Anos 60 … Anos 2020) ou um intervalo de anos à tua escolha. Todos os onzes dessa ronda vêm desse período.',
  'Lê o jogo no topo: competição, data e se o Benfica jogou em casa ou fora.',
  'Escreve o nome de um jogador no campo de texto e carregue em «Adivinha» (ou prime Enter). A lista de sugestões ajuda enquanto escreves.',
  'Se o jogador pertencer a esse onze, a fotografia dele aparece na posição certa do campo.',
  'Descobre os 11 titulares, um a um. Podes trocar o nome de quem já encontraste no campo ou desistir quando quiseres.',
];

const RULES = [
  {
    icon: timerOutline,
    title: 'Tempo',
    text: 'O cronómetro começa mal a ronda abre e só para quando ela termina. Quanto mais rápido fores, maior o bónus de tempo.',
  },
  {
    icon: trophy,
    title: 'Pontuação',
    text: 'Cada jogador encontrado vale 100 pontos. Completar o onze soma o bónus de tempo: quanto mais depressa acabares, mais pontos.',
  },
  {
    icon: bulb,
    title: 'Dicas',
    text: 'Liga as dicas para ver as iniciais de cada jogador por descobrir — «HC» para Hélder Cristóvão, «CP» para Costa Pereira. Ao usar dicas, a pontuação final é 15% menor.',
  },
  {
    icon: eye,
    title: 'Resolve',
    text: 'Desistir revela o onze completo e termina a ronda. Nesse caso ganhas apenas 25% dos pontos base.',
  },
  {
    icon: refresh,
    title: 'Repetir',
    text: 'No resumo, «Repetir» recomeça a mesma ronda e «Próximo Jogo» avança para o jogo seguinte.',
  },
  {
    icon: calendar,
    title: 'Época',
    text: 'O rodapé mostra a época do jogo atual e quantos jogos ela tem. Dentro da mesma época, «Próximo Jogo» avança para o jogo seguinte, sem repetir nenhum até os teres jogado todos.',
  },
  {
    icon: shuffle,
    title: 'Novo Jogo',
    text: 'A qualquer momento podes começar um jogo novo: escolhes outra vez a época e os jogos desse período são baralhados, sem se repetirem até teres passado por todos.',
  },
];

/** The "how to play" screen: rules, naming, scoring and the on-screen buttons. */
export default function Help({ onBack }: Props) {
  return (
    <>
      <IonHeader>
        <IonToolbar>
          <button
            type="button"
            slot="start"
            className="newGame homeBtn"
            data-testid="back"
            title="Voltar ao ecrã inicial"
            aria-label="Voltar ao ecrã inicial"
            onClick={onBack}
          >
            <IonIcon icon={arrowBack} />
          </button>
          <IonTitle>Instruções</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="helpScreen">
        <div className="help" data-testid="help-content">
          <img
            className="help__logo"
            src="assets/benfica-logo.svg"
            alt="Emblema do Sport Lisboa e Benfica"
          />
          <h1 className="help__title">Como jogar</h1>
          <p className="help__lead">
            Um jogo de memória sobre o Benfica. Em cada ronda tens de descobrir o onze inicial de um
            jogo histórico, escrevendo os nomes dos titulares.
          </p>

          <h2 className="help__head">Passo a passo</h2>
          <ol className="help__steps">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>

          <h2 className="help__head">Nomes dos jogadores</h2>
          <p className="help__body">
            Podes escrever o nome completo ou só o apelido — «Eusébio», «Eusébio da Silva Ferreira»
            ou «Silva Ferreira» encontram o mesmo jogador. Acentos e maiúsculas não contam. Um
            apelido isolado só é aceite quando nenhum outro jogador desse onze o partilha.
          </p>
          <p className="help__body">
            Na lista de sugestões, o nome à direita é o nome completo do jogador — «de Tomás»
            aparece como «Raul De Tomas». Só os jogadores conhecidos por um único nome não o
            mostram.
          </p>

          <h2 className="help__head">Regras e pontuação</h2>
          <ul className="help__rules">
            {RULES.map(({ icon, title, text }) => (
              <li key={title}>
                <IonIcon icon={icon} />
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="help__head">Progresso</h2>
          <p className="help__body">
            A barra no rodapé mostra quantos onzes já resolveste, a tua melhor sequência de vitórias
            e a pontuação total. O progresso fica guardado neste dispositivo — na barra superior
            podes sempre voltar ao ecrã inicial com a seta à esquerda.
          </p>

          <p className="help__note">
            As fotografias dos jogadores provêm de ficheiros públicos (Wikimedia Commons) e são
            usadas apenas para identificar os jogadores.
          </p>
        </div>
      </IonContent>
    </>
  );
}
