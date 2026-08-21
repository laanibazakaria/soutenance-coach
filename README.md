# 🎤 SoutenanceCoach

**Le coach d'entraînement oral qui se souvient.** Enregistre-toi en train de présenter,
obtiens une transcription en direct, une évaluation objective — et surtout, un suivi de
ta progression d'une session à l'autre.

> Projet en cours de construction (étape A / 4 — voir [MISSION.md](MISSION.md), la fiche
> de mission écrite avant la première ligne de code).

## Philosophie

- **Le modèle de langage ne note jamais.** Toute métrique (débit, mots béquilles,
  structure…) est calculée par du code déterministe et testé. Le LLM, quand il
  intervient, formule un conseil à partir de chiffres déjà établis — c'est tout.
- **Tes données restent chez toi.** Pas de compte, pas de serveur : tout vit dans le
  stockage local de ton navigateur.
- **La fiabilité d'abord.** Le cœur du produit (`lib/`) est couvert de tests dès le
  premier jour ; la CI bloque tout ce qui casse.

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests unitaires (Vitest)
npm run typecheck  # TypeScript strict
```

**Prérequis navigateur** : Chrome ou Edge (la transcription utilise la Web Speech API).

## État d'avancement

- [x] **Étape A — le socle** : enregistrement micro, transcription temps réel (fr-FR),
      sessions sauvegardées localement, CI.
- [ ] **Étape B — la grille** : métriques objectives (débit, béquilles, structure), testées.
- [ ] **Étape C — la mémoire** : tendances multi-sessions, seuil minSessions, tableau de bord.
- [ ] **Étape D — la finition** : mode soutenance chronométré, accessibilité, déploiement public.
