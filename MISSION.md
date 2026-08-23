# 🎤 SoutenanceCoach — Le coach d'entraînement oral qui se souvient

*Fiche de mission rédigée le 18 août 2026, avant toute ligne de code — méthode héritée du stage.
Projet personnel de Zakaria Laaniba · ~4 semaines (fin août → mi-septembre 2026) · budget : 0 €.*

---

## ⚠️ Garde-fous non négociables — à lire avant tout le reste

1. **Aucune ligne de code, aucun prompt, aucun asset provenant de Propulsez Coach IA.**
   Ce projet applique des *compétences* apprises en stage (qui m'appartiennent), jamais du
   *code* de l'entreprise (qui ne m'appartient pas). Domaine différent (étudiants vs
   commerciaux), base de code écrite de zéro, stack assemblée indépendamment.
2. **Les données sont strictement personnelles.** Un enregistrement, une transcription,
   un score n'appartiennent qu'à l'utilisateur qui les a produits. Pas de classement entre
   utilisateurs, pas de vue « professeur » ou « jury », pas de partage par défaut. Si une
   fonctionnalité sociale est envisagée un jour, elle commence par un opt-in explicite —
   jamais par une extension silencieuse. (Leçon de la mission 7.)
3. **Le modèle de langage ne décide jamais d'un chiffre.** Toute note, toute tendance,
   toute statistique est calculée par du code déterministe et testé. Le LLM formule le
   feedback qualitatif à partir de faits déjà établis — c'est tout.

## Le problème

S'entraîner à l'oral (soutenance, entretien de stage, présentation) se fait aujourd'hui
seul devant un miroir ou devant des amis peu disponibles. Aucun retour objectif, aucune
trace de progression. Or les défauts d'oral sont récurrents et mesurables : débit trop
rapide, mots béquilles (« euh », « du coup », « en fait »), phrases interminables,
introduction sans annonce de plan. Un étudiant qui s'entraîne 5 fois ne sait pas s'il
progresse — il ne se souvient même pas de ses défauts de la semaine passée.

**Le produit en une phrase : tu t'enregistres, tu obtiens une évaluation objective et un
conseil, et surtout — l'outil se souvient et te dit sur quoi tu progresses ou stagnes.**

## Les utilisateurs

Étudiants préparant une soutenance (PFA/PFE/stage), un entretien, un concours oral.
Premier utilisateur réel : moi, pour ma propre soutenance de stage — le produit doit être
utilisable pour ça avant la fin du projet (dogfooding obligatoire).

## Architecture décidée (et pourquoi)

| Choix | Décision | Justification |
|---|---|---|
| Framework | Next.js (App Router) + Vercel | Maîtrisé, déploiement gratuit, serverless |
| Capture audio | MediaRecorder API (navigateur) | Standard, gratuit, aucun upload requis pour la v1 |
| Transcription | Web Speech API (fr-FR) en priorité ; fallback fichier → Whisper local si besoin | Gratuit, temps réel ; la dépendance à Chrome est un compromis assumé de v1 |
| Scoring | **Bibliothèque TypeScript pure, `lib/scoring/`** — débit, béquilles, longueur de phrases, silences, structure | Déterministe, testable sans navigateur ni LLM — le cœur du produit |
| Tendances | `lib/trends/` — comparaison première/seconde moitié des sessions, seuil dur `minSessions = 3` | Même philosophie que la fiche mission 7 : sous le seuil, pas de verdict |
| LLM (qualitatif) | Ollama en local (dev) ; API Claude en option derrière une variable d'env | Coût zéro par défaut ; le produit doit fonctionner SANS LLM (mode dégradé : scores seuls) |
| Stockage | localStorage/IndexedDB (v1) — pas de compte, pas de base | Personnel par construction, RGPD trivial, friction zéro ; export/import JSON pour ne rien perdre |
| Tests | Vitest, dès le premier jour | 100 % du scoring et des tendances couverts — c'est la crédibilité du projet |

## Les étapes

### Semaine 1 — Le socle (étape A)
- Squelette Next.js + Vitest + CI GitHub Actions (lint + tests sur chaque push).
- Enregistrement micro (MediaRecorder) + transcription temps réel (Web Speech API, fr-FR).
- Écran session : enregistrer → voir sa transcription → sauvegarder localement.
- **Definition of done** : je peux m'enregistrer 2 minutes et relire ma transcription.

### Semaine 2 — La grille (étape B)
- `lib/scoring/` : fonctions pures → mots/minute, taux de mots béquilles (liste FR
  configurable), longueur moyenne des phrases, ratio de silences, détection d'annonce de
  plan dans l'intro. Chaque métrique : bornée, documentée, testée (~20 tests).
- Écran résultat : les métriques avec leurs seuils (vert/orange/rouge) et le pourquoi.
- Feedback LLM optionnel : un seul conseil actionnable, généré à partir des métriques
  calculées — le prompt reçoit les chiffres, il n'en produit jamais.
- **DoD** : deux enregistrements différents produisent des scores différents, explicables,
  reproductibles ; `vitest run` vert.

### Semaine 3 — La mémoire (étape C — le différenciateur)
- `lib/trends/` : progression/stagnation/régression par métrique sur les N dernières
  sessions ; seuil dur minSessions = 3 ; jamais d'exception, une métrique absente est
  absente du résultat. (~12 tests.)
- Tableau de bord : historique des sessions, courbes par métrique, insights du type
  « ton débit s'améliore (156 → 138 mots/min) mais tes “du coup” stagnent depuis 4 sessions ».
- **DoD** : après 4 sessions réelles, le tableau de bord me dit quelque chose de vrai et
  d'utile sur ma progression.

### Semaine 4 — La finition (étape D)
- Mode « entraînement soutenance » : minuteur par section (intro/développement/conclusion),
  comparaison au plan annoncé.
- Polish UI (accessibilité clavier et ARIA — leçon de la mission 6), export/import JSON.
- Déploiement Vercel public + README exemplaire (captures, architecture, philosophie).
- Dogfooding final : je prépare MA soutenance avec l'outil, et j'en tire le post LinkedIn
  de lancement (« j'ai construit l'outil avec lequel j'ai préparé ma soutenance »).

### Bonus (seulement si le temps le permet, à cadrer séparément)
- Analyse de questions/réponses (mode entretien) ; upload d'un PDF de slides pour
  vérifier la couverture du plan ; PWA installable mobile.

## Ce qu'on attend (critères d'acceptation)

- [ ] `lib/scoring/` et `lib/trends/` : fonctions pures, zéro dépendance au DOM, ~30 tests verts.
- [ ] Le produit complet fonctionne **sans LLM** (mode métriques seules) ; le LLM n'ajoute que du qualitatif.
- [ ] Aucune donnée ne quitte le navigateur en v1 (vérifiable dans l'onglet réseau).
- [ ] CI verte sur GitHub, README avec captures et section « Philosophie : pourquoi le LLM ne note jamais ».
- [ ] Déployé publiquement sur Vercel, utilisable par n'importe quel étudiant sans inscription.
- [ ] J'ai préparé ma propre soutenance avec — au moins 4 sessions réelles enregistrées.
- [ ] Garde-fous relus avant chaque merge : rien de Propulsez, données personnelles, LLM jamais décisionnaire.

## Les pièges connus

- **Web Speech API ne marche bien que sur Chrome/Edge** : l'assumer visiblement (bandeau
  navigateur non supporté), ne pas se lancer dans un support Safari/Firefox en v1.
- **La transcription fr est imparfaite** : les métriques doivent être robustes au bruit
  (un « euh » transcrit « heu » compte quand même — liste de variantes).
- **Le piège du perfectionnisme UI** : le cœur, c'est scoring + tendances testés. Une UI
  simple et propre suffit ; le temps passé sur des animations est du temps volé à la crédibilité.
- **Le piège du LLM partout** : la tentation de « laisser Claude noter, c'est plus simple ».
  Non. C'est exactement ce que le projet démontre qu'il ne faut pas faire.

## Pistes non retenues pour la v1 (à noter, pas à construire)

- Comptes utilisateurs et base de données — la friction tuerait l'adoption, et le
  localStorage suffit à prouver le concept.
- Analyse vidéo (posture, regard) — un autre projet à part entière.
- Toute vue multi-utilisateurs (classe, professeur) — exclue par le garde-fou n°2,
  pas juste reportée.

## Livraison

- Dépôt public : `github.com/laanibazakaria/soutenance-coach` — commits propres, anglais
  ou français cohérent, branche `main` protégée par la CI.
- Une PR par étape (A, B, C, D), auto-relue avec la question : *« si Charles relisait
  cette PR, qu'est-ce qu'il soulignerait ? »*
- Point d'étape hebdomadaire : chaque fin de semaine, bilan honnête — fait / pas fait / appris.

## Étape E — Le parcours J-X (fiche écrite avant le code, 23 août 2026)

**Le manque.** L'application mesure et fait répéter, mais n'accompagne pas : un étudiant
qui a une date ne sait pas quoi faire ce soir. Un bon coach humain commence par « c'est quand ? ».

**Ce qui est construit.** L'étudiant donne sa date et son format (PFA 15 min, PFE 20 min,
autre). Un catalogue d'étapes — déposer ses slides, lire son pitch, première répétition,
questions du jury, répétition chronométrée, simulation d'entretien, trois sessions, une
session dans les temps, une session propre, la veille, le jour J — est réparti sur les jours
restants ; les deux derniers jours sont réservés. Une jauge « Prêt à X % » et la liste
« à faire maintenant » (dû aujourd'hui ou en retard) sont le cœur de l'écran.

**Garde-fous propres à cette étape.**
- *Détection automatique plutôt que déclaration* : une étape prouvée par l'activité (une
  session avec durée visée existe, un pitch est en cache) se coche seule et se marque
  « détectée ». Les autres se cochent à la main — on ne devine pas.
- *Le plan ne bouge pas* : réparti à partir du jour de création, pas d'aujourd'hui. Sinon rien
  n'est jamais en retard, et « en retard » est précisément l'information utile.
- *Dates civiles, pas d'horloge dans la logique* : tout est pur et testé avec des dates en
  paramètre ; le composant seul lit `new Date()`.
- *Le jour J ne compte pas dans la progression* : on ne peut pas l'avoir « fait » avant.
- *Synchronisé comme le reste* : même forme locale et distante, fusion = champs du plus
  récent + union des étapes cochées.

**Extensions prévues** : les fonctions suivantes (répétition avec slides, avis du coach,
fiches à mémoriser, guide) deviendront des étapes du catalogue.

## Étape F — Répéter avec ses slides (fiche écrite avant le code, 23 août 2026)

**Le manque.** On répète « dans le vide » : la session mesure l'élocution, pas la gestion du
support. Or le jury voit d'abord ça : une diapositive qui mange trois minutes, une autre
survolée, la conclusion bâclée faute de temps.

**Ce qui est construit.** La diapositive courante à l'écran (texte extrait ; ou le vrai PDF
si l'étudiant le recharge — il ne quitte pas le navigateur), avance au clavier, un chrono par
diapositive face au temps prévu, et à la fin un bilan : prévu / réel / écart par diapositive,
les non vues, le pire dépassement, une phrase qui dit où part le temps. Le temps par
diapositive est sauvegardé avec la session et synchronisé.

**Garde-fous.**
- *Le prévu a une origine* : le minutage du pitch généré pour cette durée ; sinon une
  répartition uniforme, affichée comme telle avec l'invitation à générer le pitch.
- *Un seul enregistreur* : la logique Web Speech est extraite dans un hook partagé avec la
  session classique — pas deux implémentations des redémarrages silencieux.
- *Le retour en arrière compte* : les passages sur une même diapositive se cumulent.
- *Seuils exportés* (± 20 % vert, ± 50 % orange), pas de note globale.

## Étape G — L'avis du coach (fiche écrite avant le code, 23 août 2026)

**Le manque.** Les métriques disent *comment* l'étudiant parle. Personne ne lui dit *ce qu'il a
oublié* de ses propres slides, ni *quelle phrase* était confuse. C'est le retour qu'un bon
encadrant donne après une répétition — et qu'un étudiant seul n'a jamais.

**Ce qui est construit.** Un bouton, jamais un appel automatique : « Demander l'avis du coach ».
Le modèle reçoit la transcription, le texte numéroté des diapositives, le temps par diapositive
s'il existe, et les mesures déjà calculées. Il rend : oublis (avec numéro de diapositive),
passages confus cités entre guillemets, reformulations avant → après, points forts, une
priorité. Disponible à la fin d'une session, à la fin d'une répétition avec slides, et depuis
l'historique. Un avis par session, mis en cache et synchronisé.

**Garde-fous.**
- *Jamais de note* : la consigne l'interdit ; un avis hors format est refusé, pas rafistolé.
- *Les chiffres viennent du code* : ils sont transmis comme des faits « à ne pas contredire ».
- *Sans support, pas d'oublis inventés* : la consigne exige une liste vide.
- *Ce qui est envoyé est borné* (7 000 caractères de transcription, 5 000 de slides) et
  ne contient jamais l'audio ni le PDF.
- *Identifiant fixé à l'arrêt* : l'avis demandé avant la sauvegarde reste attaché à la session.
