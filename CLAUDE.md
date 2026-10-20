# Arcade — repères pour Claude Code

Borne d'arcade rétro dans le navigateur. TypeScript strict, Vite, Vitest, Prettier.
Aucun framework de rendu : DOM et Canvas 2D. Node 20.19 ou plus récent.

## Commandes

```sh
npm install      # installe les dépendances
npm run dev      # lance l'arcade en local
npm run build    # vérifie les types (tsc) et produit dist/
npm test         # lance les tests Vitest
npm run lint     # vérifie le formatage avec Prettier
```

## Arborescence `src/`

- `main.ts` : point d'entrée
- `shell/` : cadre de l'arcade, effet CRT, menu, clavier, choix du thème
- `games/snake/` : logique, rendu et enregistrement du jeu
- `games/2048/` : fusion, grille, rendu et enregistrement du jeu
- `games/casse-briques/` : écran d'attente du jeu
- `scores/` : tableau des scores, stockage, partage
- `theme/` : palette néon et thème sobre
- `legacy/` : records, compteurs de parties et dernier joueur

Les tests Vitest sont dans `test/`.
