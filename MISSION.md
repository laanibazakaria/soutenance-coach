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

## Étape H — Les fiches à mémoriser (fiche écrite avant le code, 23 août 2026)

**Le manque.** Le moment le plus visible d'une soutenance ratée : l'étudiant qui sèche sur
*son propre* chiffre, ou qui ne sait pas définir le sigle écrit sur *sa* diapositive 4.

**Ce qui est construit.** Des fiches recto/verso générées depuis le support : chiffres clés,
définitions, choix à justifier, questions pièges — chacune rattachée à sa diapositive. Une
révision « je savais / je ne savais pas », avec rappel espacé (boîtes de Leitner : 1, 3, 7,
14 jours) ; une fiche ratée revient le jour même et en fin de séance. Une liste complète avec
niveau par fiche et « tes fiches difficiles ». Progression synchronisée avec les résultats IA.

**Garde-fous.**
- *Interdit d'inventer* : la consigne exige que chaque chiffre vienne du support ; un choix
  dont la raison n'est pas dans les slides devient « À préparer : le support ne le dit pas ».
- *La mémoire est du code* : intervalles exportés et testés, aucun modèle dans la boucle de
  révision.
- *Identifiants stables* (dérivés du recto) : régénérer des fiches identiques ne perd pas la
  progression.
- *Répondre à voix haute avant de retourner* : rappelé à chaque fiche — c'est l'oral qu'on
  prépare, pas un QCM.

## Étape I — Le guide de la soutenance (23 août 2026)

**Le manque.** Le déroulé, la composition du jury, ce qu'il note, la bonne manière de dire
« je ne sais pas » : tout ça s'apprend d'habitude *après* la première soutenance. Un texte
de dix minutes, relu la veille, vaut une heure de répétition mal orientée.

**Ce qui est construit.** Une page statique en huit sections : comment ça se passe (PFA/PFE,
rôles du jury, le temps), ce que le jury note vraiment, les dix erreurs classiques, répondre
aux questions (méthode en quatre temps, la question sans réponse, la critique juste et
injuste, le piège), voix/regard/corps, la veille, le jour J, et « si ça tourne mal ». Les
étapes « la veille » et « le jour J » du parcours y renvoient ; une étape manuelle « lis le
guide » ouvre le parcours.

**Garde-fou.** Les durées et compositions de jury sont données comme des ordres de grandeur
avec le rappel explicite que le règlement de l'école fait foi — on ne promet pas ce qu'on
ne contrôle pas.

## Étape J — Le module Entretien d'embauche (fiche écrite avant le code, 23 août 2026)

**Le manque.** Après la soutenance vient l'entretien — même enjeu, même solitude. Un lauréat
répète « présentez-vous » devant son miroir et découvre les questions le jour J.

**Ce qui est construit.** Un module à côté de la soutenance, comme les modules d'une plateforme
de coaching commercial : profil de candidature (poste, offre, CV en texte), questions
spécifiques tirées du CV et de l'offre (écarts, affirmations à prouver) avec « ce qu'il vérifie »
et « ce qu'une bonne réponse contient », banque de vingt classiques, simulation RH ou technique
qui relance, pitch de 2 minutes avec coach comparant au CV, guide, checklist avec détection.

**Garde-fous.**
- *Le CV reste dans le navigateur* : seul son texte est conservé et envoyé.
- *Jamais de note* : mêmes mesures déterministes que le jury (`analyserReponse`), même contrat
  de réponse (`parseAvis`), même refus d'un avis hors format.
- *Spécifique ou rien* : la consigne interdit les questions posables à n'importe quel candidat ;
  la banque classique porte, elle, l'« attendu » rédigé à la main.
- *Les écarts sont posés avec respect* : la consigne le dit explicitement — on prépare, on ne
  humilie pas.

## Étape K — Le moteur de modules : Pitch de projet, Oral de concours (23 août 2026)

**Le manque.** Après l'entretien, deux autres oraux décisifs pour un étudiant : le pitch d'un
projet devant un jury d'innovation, et l'oral d'admission ou de concours. Les copier trois fois
aurait donné trois codes à maintenir.

**Ce qui est construit.** Une définition de module (`lib/modules`) : champs du profil, banque
classique rédigée à la main avec l'« attendu », persona et critères du jury, checklist avec
détection, guide. Un seul moteur rend le hub (`/app/m/[module]`), la simulation, les questions
IA, la présentation chronométrée (`/app/session?mode=…`) et l'avis du coach comparé au dossier.
Les profils sont synchronisés (table `ProfilModule`, clé utilisateur + module).

**Garde-fous.** Les mêmes : dossier lu dans le navigateur, texte seul envoyé ; questions
spécifiques ou rien ; mesures par du code, jamais de note ; faiblesses pointées avec respect.
Le module Entretien, construit avant le moteur, garde sa propre implémentation — à migrer un
jour sur le moteur, sans urgence : il marche.

## Étape L — Les fondations du payant (24 août 2026)

**Le manque.** Un palier gratuit partagé ne survit pas à un utilisateur enthousiaste : le quota
Gemini a été atteint une fois pendant les tests. Et vendre un jour suppose de savoir qui
utilise quoi, et qui est prêt à payer.

**Ce qui est construit.** Quotas par mois civil — par compte, ou par empreinte d'adresse sans
compte (l'adresse n'est jamais stockée) — consommés juste avant chaque appel au modèle, après
validation de la requête ; message clair à la limite, qui invite à créer un compte. Compteur
dans la barre latérale. Page Forfaits : Gratuit aujourd'hui, Pro bientôt avec liste d'attente.
Tableau de bord admin : comptes, sessions, appels IA, liste d'attente — jamais une transcription.

**Garde-fous.** L'administrateur n'a pas de quota mais pas non plus d'accès aux contenus ; une
requête invalide ne consomme rien ; sans base configurée, rien n'est compté (un déploiement
local reste simple).

## Étape M — Calendrier, bilan, partage, application installable (24 août 2026)

Ce qui fait revenir : la date dans l'agenda (.ics, rappel la veille) ; un **bilan** — une
photographie lisible de la préparation, chiffres et tendances, jamais une transcription — à
imprimer en PDF (mise en page d'impression, pas de bibliothèque) ou à **partager** par un lien
en lecture seule qui expire après 30 jours ; un manifeste PWA pour installer l'application
sur le téléphone. Garde-fou : le partage est un instantané, sans identité ni contenu privé.

## Étape N — La soutenance blanche (24 août 2026)

La répétition générale : trois phases enchaînées sans rien réinventer — la page Répéter en
mode blanche pour l'exposé, le jury (questions spécifiques d'abord) avec mesures et avis,
puis un débrief qui rassemble temps par diapositive, élocution, avis du coach et chaque
réponse. Le résultat est attaché à la session (cache IA `blanche:<id>`, synchronisé) et
rouvrable depuis l'historique. Pas de réponse à la relance dans la blanche : on la note, elle
tombera le jour J — et on ne double pas la consommation du quota.

## Étape O — Le mémoire en entrée (24 août 2026)

Pour un PFE ou une thèse, le jury interroge sur le document, pas sur les slides. Le mémoire
est déposé en PDF, lu dans le navigateur, son texte conservé (borné) et synchronisé avec les
résultats IA. Le rapporteur IA en tire dix questions — citant un passage, un chiffre, une
absence — qui rejoignent les questions courantes. Quand le document dépasse la borne d'envoi,
on transmet le début et la fin (problématique, méthode / résultats, limites, conclusion), et
on le dit dans la consigne.

## Étape P — Réécoute-toi (24 août 2026)

Entendre son propre « euh » vaut mille conseils. L'audio est capturé localement (MediaRecorder,
IndexedDB) et réécoutable ; il ne quitte jamais l'appareil — ni synchronisation, ni envoi — et
part avec la session, à la déconnexion, à la suppression du compte. Pendant l'enregistrement,
l'intensité est échantillonnée (Web Audio) ; les mesures — blancs longs, part de silence,
dynamique de la voix — sont du code pur et testé, avec un seuil de silence adaptatif au bruit
de fond. Le hook accepte désormais une langue de reconnaissance.

## Étape Q — L'oral en anglais (24 août 2026)

Entretiens et oraux en anglais sont fréquents pour les lauréats. Une préférence locale règle
la langue de reconnaissance, la liste des béquilles s'enrichit des anglaises, et les jurys IA
répondent en anglais quand l'oral est en anglais. Le reste de l'interface reste en français :
c'est l'oral qui change de langue, pas le coach.

## Étape R — Le retour visible, tout de suite (24 août 2026)

Ce qui fait dire « cette app m'a vraiment aidé » : voir ses mots avec ses béquilles surlignées
(même détection que le comptage, une seule source de vérité, testée), une jauge de débit qui
réagit pendant qu'on parle, et, après une réponse au jury, l'exemple de ce qu'un excellent
candidat aurait dit — sur son dossier, jamais un corrigé générique, avec les faits manquants
marqués « à compléter » plutôt qu'inventés. Un exemple par question, en cache, synchronisé.
