---
name: conventions-vitest
description: Conventions à respecter pour écrire ou modifier un fichier de test Vitest (*.test.ts, *.spec.ts et variantes) : imports explicites, un it par comportement, aucune dépendance au temps réel ni au hasard, remplacements restaurés. Chargée automatiquement quand Claude travaille sur un fichier de test.
user-invocable: false
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/*.test.tsx"
  - "**/*.spec.tsx"
  - "**/*.test.js"
  - "**/*.spec.js"
  - "**/*.test.jsx"
  - "**/*.spec.jsx"
  - "**/*.test.mjs"
  - "**/*.spec.mjs"
  - "**/*.test.mts"
  - "**/*.spec.mts"
---

# Conventions des tests Vitest

- Importer explicitement depuis `vitest` (`describe`, `it`, `expect`, `vi`) : ne pas compter sur les globales.
- Un `it` par comportement, nommé par une phrase qui le décrit, dans la langue des tests existants.
- Le résultat attendu vient de la spécification, pas de la sortie actuelle du code.
- Aucune dépendance au temps réel, au hasard, au réseau ou à l'ordre des tests : faux timers, générateur injecté ou `vi.spyOn(Math, 'random')`, stockage en mémoire neuf à chaque test.
- Tout ce qui est remplacé est restauré dans `afterEach` : `vi.useRealTimers()`, `vi.restoreAllMocks()`, `vi.unstubAllGlobals()`.
- Pas d'instantané pour de la logique ; pas d'`it.only`, d'`it.skip` ni de `console.log` laissés dans le fichier.
- Pour écrire une série de tests ou reproduire un bug, utiliser la skill `ecrire-tests` du même plugin (`/tests-vitest:ecrire-tests`).
