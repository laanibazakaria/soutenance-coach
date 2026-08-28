# 🎓 SoutenanceCoach

**Un jury qui a lu ton mémoire, et qui t'appelle pour en parler.**

Tu déposes ton rapport et ta présentation. Quatre membres du jury les lisent **en entier, ligne à ligne**, puis t'appellent : ils parlent, tu réponds au micro, ils rebondissent — et ils **se souviennent de toi** d'un appel à l'autre. À la fin : une note calculée par du code sur treize critères pondérés, et un pronostic honnête pour le jour J.

### 👉 [Utiliser l'application](https://soutenance-coach.vercel.app)

Gratuit, open source, sans installation (Chrome ou Edge). L'audio et les fichiers ne quittent jamais l'appareil : seul le texte extrait est envoyé au modèle.

---

## Pour qui

**L'élève-ingénieur, aux deux oraux qui décident de son année :**

- **La soutenance** (PFA, PFE, mémoire, thèse) — un jury académique de quatre voix : le rapporteur qui a lu le document de près, la présidente qui cadre, l'encadrant qui tend des perches, et l'examinatrice externe — spécialiste de la filière du candidat, elle pousse sur le fond disciplinaire.
- **L'entretien** (stage, alternance, premier poste) — une chargée de recrutement et un manager technique qui ont lu le CV **et** l'offre, et qui posent les questions de *ce* recruteur-là.

Le parcours tient en une phrase, et la navigation la répète : **① dépose tes documents → ② passe un appel → ③ suis ta progression.**

## Ce qui le distingue

### Le jury lit tout — et le prouve

Un mémoire de 100 pages est lu en passes successives (jusqu'à ~270 pages), et l'écran dit exactement ce qui a été couvert : *« Lu en entier : 42 pages, en 3 passes »* — ou l'avoue quand une passe a échoué. Une **relecture croisée** confronte ensuite la présentation au rapport, comme un vrai rapporteur : ce que le jury a compris, ce qui est solide, **ce qui ne concorde pas entre les deux documents** (chaque écart cité des deux côtés), et les questions auxquelles le dossier ne répond nulle part. Ces trouvailles deviennent les *notes du rapporteur* que le jury emporte dans l'appel.

### Le jury se souvient

Chaque appel nourrit la mémoire du suivant. Le jury **rouvre sur la question restée sans bonne réponse** — *« La dernière fois, vous n'aviez pas su me dire… je vous repose la question »* — revient sur les critères faibles plutôt que d'explorer du neuf, et reconnaît sobrement le progrès : *« Bien. Cette fois vous l'avez. »* Battre le jury sur la question qui vous avait fait échouer : c'est la progression qu'on vit, pas celle qu'on lit sur une courbe.

### La note, c'est le code qui la calcule

Un modèle de langage se trompe de manière *plausible* : une note fausse ressemble à une note juste. Ici, **l'IA juge chaque critère et cite ses raisons ; la moyenne pondérée est recalculée par du code** — et quand trop peu de critères ont pu être observés, il n'y a **pas de note du tout**, plutôt qu'un chiffre posé sur du vide. La grille distingue même ses deux volets : un appel ne juge que les *questions* ; seule la soutenance blanche, qui rejoue l'oral entier, peut mener à « Prêt ».

### Le pronostic

En tête de chaque grille, la réponse à la question qu'on se pose vraiment à 23h : **« Si ton oral était demain : entre 11,5 et 14,5 / 20. »** Fourchette calculée par du code, dont la largeur dit honnêtement ce qui n'a pas été observé.

## Les principes d'ingénierie

Ce projet applique la discipline apprise en stage chez [Propulsez](https://propulsez.fr) — fiabiliser une application d'IA en production — dont il transpose aussi le concept produit (appels simulés + grilles pondérées calculées) au monde étudiant.

1. **Le code calcule, le modèle rédige.** Débit, mots béquilles, temps, notes : déterministes et testés. L'IA écrit les questions, les constats, les conseils — jamais un chiffre final.
2. **S'abstenir plutôt qu'inventer.** Pas assez de données → « non mesuré », avec la raison. Grille trop peu couverte → pas de note. Rapport tronqué → la portée l'annonce (*« les 20 premières pages sur 37 »*).
3. **Ne jamais croire le modèle sur parole.** Une « contradiction chiffrée » dont les deux citations portent les mêmes nombres (« 45 » / « quarante-cinq ») est **écartée par du code** — le prompt l'interdit, le parseur le vérifie. Une incohérence sans ses deux citations est jetée : une demi-accusation est pire que rien.
4. **Le quota ne fuit pas.** Vérifié avant l'appel au modèle, consommé seulement après succès ; chaque route IA porte son `maxDuration` ; et un déploiement sans base **crie** dans les logs que les quotas sont désactivés au lieu de l'ouvrir en silence.
5. **Tout est vérifié.** 456 tests unitaires, TypeScript strict, et des tests qui figent jusqu'aux consignes des prompts — pour qu'un remaniement n'efface pas une règle de conduite du jury.

## Journal des incidents — trouvés, compris, corrigés

Les leçons les plus utiles viennent d'appels réels :

| Symptôme observé | Cause | Correctif |
|---|---|---|
| Le jury cite « la ligne 123 de l'annexe A » — trois versions contradictoires | Le prompt ordonnait « cite précisément » un extrait de 7 000 signes | Le prompt annonce un *extrait*, interdit tout numéro absent, exige la cohérence entre tours |
| 6 « écarts » sur 7 étaient faux lors du premier test sur un vrai PFE | « 45 » vs « quarante-cinq », formats de dates, numérotations | Liste explicite des non-écarts + comparateur de nombres en toutes lettres (`lib/dossier/nombres.ts`) |
| Onze questions de plus en plus dures posées à un candidat resté muet | Le « (silence) » était traité comme une réponse | Règle de relance : reformuler, jamais empiler ; « un silence n'est jamais un aveu » |
| « Prêt » affiché sur 3 critères évalués sur 12 | Seuil d'abstention absolu (6) sur des poids sommés à 18,5 | Seuil en ratio (60 % du volet) + « Prêt » réservé à l'oral entier |
| Lecture du dossier : écran figé, quota brûlé, rien rendu | Pas de `maxDuration`, boucle de passes non bornée dans le temps | Budget temps explicite, arrêt propre, voyant « X passes sur Y » enfin branché |
| La page annonçait 2 unités de quota par appel — il en coûtait 4 | Coût jamais recompté après ajout de la lecture et de la grille | Débrief + grille fusionnés (4 → 3 unités), coût affiché exact |

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
```

Navigateur : **Chrome ou Edge** (Web Speech API pour la transcription — l'application le dit si le navigateur ne la propose pas).

```bash
npm test           # 456 tests unitaires (Vitest)
npm run typecheck  # TypeScript strict
npm run build      # build de production
```

### Configuration

```
GEMINI_API_KEY=...   # clé Google AI Studio (palier gratuit suffisant) — voix + repli IA
```

En local : `.env.local` (ignoré par git). Sur Vercel : *Settings → Environment Variables*. Les appels IA passent par une cascade de fournisseurs gratuits (`lib/llm.ts`) avec repli automatique sur 429/5xx ; toute clé absente est simplement sautée. Les comptes (magic link, Google, mot de passe) et la synchronisation multi-appareils demandent une base PostgreSQL (`DATABASE_URL`, Neon) — **sans base, tout fonctionne en local sur l'appareil**, et les quotas sont désactivés (bruyamment).

## Architecture en bref

- **Next.js 16** (App Router), React 19, TypeScript strict, Vercel.
- **La logique vit dans `lib/`, pure et testée** : grilles et pronostic (`lib/grille/`), jury et mémoire (`lib/appel/`), relecture croisée (`lib/dossier/`), mesures d'élocution (`lib/scoring/`, `lib/audio/`). Les routes API sont minces ; les pages, des vues.
- **Les données de l'étudiant vivent dans son navigateur** (localStorage + IndexedDB pour l'audio), synchronisées vers PostgreSQL quand un compte existe. Aucun fichier déposé n'est stocké côté serveur — seul le texte extrait transite.
- **Voix** : Gemini TTS en streaming, un timbre par membre du jury ; repli sur les voix du navigateur. Transcription : Web Speech API.

## Limites connues

- La transcription dépend du navigateur : hors Chrome/Edge, l'appel vocal n'est pas disponible.
- Le pronostic est une estimation calibrée sur la grille, pas une promesse — il le dit lui-même.
- Un rapport au-delà de ~40 000 signes n'est confronté qu'en partie lors de la relecture croisée (la portée l'affiche).

## Licence

MIT — © Zakaria Laaniba, élève-ingénieur en IA à l'ENSIAS. Le concept d'entraînement par appels simulés et grilles pondérées est inspiré de [Propulsez](https://propulsez.fr), où il a été appris en stage — qu'ils en soient remerciés.
