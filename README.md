# 🎤 SoutenanceCoach

**Le coach d'entraînement oral qui se souvient.** Enregistre-toi en train de présenter,
obtiens une évaluation objective de ton élocution — et surtout, un suivi de ta progression
d'une session à l'autre.

### 👉 [Utiliser l'application](https://laanibazakaria.github.io/soutenance-coach/)

Aucune installation, aucun compte. Ouvre le lien dans Chrome ou Edge, autorise le micro,
et parle. *(Tes enregistrements restent sur ton appareil.)*

> Construit en août 2026 par [Zakaria Laaniba](https://laanibazakaria.github.io), élève-ingénieur
> en IA à l'ENSIAS, après un stage passé à fiabiliser une application d'IA en production.
> J'ai préparé ma propre soutenance avec.

![L'écran d'accueil de SoutenanceCoach](docs/accueil.png)

---

## Le problème

Un étudiant qui prépare une soutenance s'entraîne devant un miroir ou un ami. Il n'obtient
aucune mesure objective — et surtout, **aucune mémoire** : personne ne peut lui dire
« tu dis toujours *du coup* toutes les trois phrases, et ça ne s'améliore pas depuis quatre
séances ». C'est pourtant exactement ce qu'un bon coach humain apporte.

## La philosophie : pourquoi le modèle de langage ne note jamais

Ce projet applique une règle apprise en production : **un score faux mais crédible est plus
dangereux qu'un crash.** Un modèle de langage se trompe de manière *plausible* — une note
fausse ressemble à une note juste, et rien ne la distingue.

Donc ici :

- **Chaque chiffre est calculé par du code déterministe et testé** (`lib/scoring/`,
  `lib/trends/`) : débit, densité de béquilles, longueur des phrases, structure, tenue du temps.
- **Quand les données ne suffisent pas, la métrique s'abstient.** Elle affiche « non mesuré »
  et explique pourquoi, plutôt que de produire un verdict sur du bruit. Trois exemples réels,
  chacun découvert en utilisant l'outil et verrouillé par un test :
  - une transcription hachée en fragments de 4 mots ne prouve pas des « phrases qui respirent » ;
  - un débit calculé sur une transcription qui a perdu 35 % des mots dit « je t'ai mal entendu »,
    pas « tu parles lentement » ;
  - une tendance sur deux points, c'est du bruit — il en faut **trois minimum**, sans exception.
- **Aucune donnée ne quitte le navigateur.** Pas de compte, pas de serveur, pas d'appel réseau :
  tout vit dans le stockage local. Vérifiable dans l'onglet Réseau.

## En pratique

Tu choisis le format de ton exercice — les durées correspondent aux soutenances réelles
(PFA 15 min, PFE 20 min) — puis tu parles. La transcription suit en direct, et le minuteur
passe à l'orange dans les 10 % finaux, au rouge au dépassement.

![L'écran de session avec les formats PFA et PFE](docs/session.png)

## Ce que ça mesure

| Métrique | Ce qu'elle regarde | Quand elle s'abstient |
|---|---|---|
| **Tenue du temps** | Écart à la durée visée (mode soutenance) | Entraînement libre |
| **Débit de parole** | Mots/minute, zone de confort 110–160 | Session < 10 s, ou transcription peu fiable |
| **Mots béquilles** | « euh », « du coup », « en fait »… pour 100 mots | Aucun mot analysable |
| **Longueur des phrases** | Moyenne, et phrases de plus de 30 mots | Transcription hachée (< 7 mots/phrase) |
| **Structure annoncée** | Annonce de plan en intro, marqueur de conclusion | Session < 60 mots |

Et la mémoire : sur les **6 dernières sessions mesurables**, chaque métrique devient une
tendance — *en progression*, *stable*, *en recul* — avec les valeurs brutes
(« 12,5 → 0,8 béquilles pour 100 mots »). Stagner au bon niveau se dit « c'est acquis » ;
stagner au mauvais, « c'est TON point de travail prioritaire ».

## Et avec l'IA : pitch, questions de jury, simulation d'entretien

Dépose le PDF de tes slides. Seul le **texte extrait** est envoyé au modèle — jamais le fichier.

| Fonction | Ce que fait le modèle | Ce que fait le code |
|---|---|---|
| **🎬 Mon pitch** | Rédige l'accroche, ce que dire sur chaque diapositive, les transitions, la conclusion, trois conseils de livraison propres au support | Renormalise le minutage vers la durée visée — un modèle ne décide pas d'un chiffre |
| **🎓 Questions du jury** | Génère les questions *spécifiques* à ce projet : elles citent une technologie nommée, un chiffre avancé, un choix de conception, et pointent les faiblesses réelles | Interdit dans la consigne toute question posable à n'importe quel projet ; rattache chaque question à sa diapositive ; une banque de questions classiques reste disponible hors ligne |
| **🎤 Simulation d'entretien** | Donne son avis de jury sur ta réponse orale : ce qui fonctionne, ce qu'il relèverait, ce qu'il attendait, sa relance probable | Mesure longueur, hésitations, présence d'un exemple concret et temps de réaction — avant et indépendamment du modèle |

**Le modèle n'attribue jamais de note.** Chaque consigne le lui interdit explicitement, et une réponse hors format est refusée plutôt que présentée comme fiable.

Sans clé configurée, tout le reste fonctionne : l'analyse du support, les questions classiques, les mesures de réponse.

### Configuration

```
GEMINI_API_KEY=...        # clé Google AI Studio (palier gratuit suffisant)
GEMINI_MODEL=gemini-3.6-flash   # optionnel — Google retire régulièrement les anciens modèles
```

En local : dans `.env.local` (ignoré par git). Sur Vercel : *Settings → Environment Variables*.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
```

**Prérequis navigateur** : Chrome ou Edge — la transcription utilise la Web Speech API.
L'application le dit explicitement si le navigateur ne la propose pas.

```bash
npm test           # 81 tests unitaires (Vitest)
npm run typecheck  # TypeScript strict
npm run build      # build de production
```

## Architecture

```
app/
├── page.tsx              Tableau de bord : tendances, historique, export/import
├── session/page.tsx      Enregistrement, transcription temps réel, rapport
└── components/           Présentation pure (aucun calcul)
lib/
├── scoring/              Les 5 métriques — fonctions pures, seuils exportés
├── trends/               La mémoire — pénalités normalisées, seuil minSessions
├── storage.ts            Persistance locale, export/import JSON
└── types.ts
tests/unit/               81 tests, dont des fixtures de sessions réelles
```

Le cœur (`lib/`) n'a **aucune dépendance au DOM** : il se teste sans navigateur, et les
composants ne font que l'afficher. Les seuils sont exportés (`SEUILS`, `SEUILS_TENDANCES`)
pour rester critiquables plutôt que cachés dans le code.

## Limites connues (v1)

Elles sont écrites ici plutôt que découvertes à l'usage :

- **Chrome/Edge uniquement** — la Web Speech API n'est pas disponible partout.
- **La transcription française est imparfaite.** Les métriques sont conçues pour y résister
  (variantes de béquilles regroupées, marqueurs de conclusion tolérants, abstention si la
  confiance est basse), mais un micro éloigné dégrade la mesure. L'app le signale.
- **La tendance compare des moyennes de moitiés de fenêtre** : un pic isolé en bord de
  fenêtre pèse sur sa moitié. Comportement documenté et testé ; passage à la médiane prévu
  si l'usage le justifie.
- **Pas de découpage par section** (intro/développement/conclusion chronométrés séparément) :
  noté dans la fiche de mission comme évolution, pas construit en v1.

## Journal de bord

Ce projet a été construit en quatre étapes, chacune vérifiée par l'usage réel — et plusieurs
correctifs viennent directement de sessions d'entraînement enregistrées avec l'outil :

| Étape | Contenu |
|---|---|
| A | Socle : enregistrement, transcription temps réel, sessions locales |
| B | La grille : 5 métriques déterministes et leurs seuils |
| C | La mémoire : tendances multi-sessions, seuil de 3 sessions non négociable |
| D | Mode soutenance chronométré, export/import, accessibilité, publication |

La fiche de mission complète — rédigée **avant la première ligne de code** — est dans
[MISSION.md](MISSION.md), garde-fous compris.

## Licence

MIT.
