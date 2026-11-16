# arcade-devkit

Boîte à outils MCP pour développer des bornes d'arcade.

## Outils

- `palette_retro` : palette de couleurs rétro pour un thème (`neon`, `sobre`, `ambre`).
- `lister_templates_jeux` : modèles de mini-jeux fournis par le devkit.
- `touches_arcade` : mapping clavier et manette d'un jeu.
- `obtenir_regles_tournoi` : règles officielles de l'Arcade Cup, à respecter pour homologuer
  une borne.

## Installation

Serveur stdio, à déclarer depuis la racine du projet :

```sh
claude mcp add --transport stdio --scope project arcade-devkit -- node mcp/serveur-scores.js
```

Dans le panneau VS Code, ouvrez une nouvelle conversation : Claude Code lance le serveur sans
demander d'approbation. Dans le terminal, lancez `claude` et approuvez le serveur. Tapez ensuite
`/mcp` et vérifiez qu'`arcade-devkit` est connecté, avec quatre outils.
