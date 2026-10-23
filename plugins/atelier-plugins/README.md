# atelier-plugins

L’outillage du mainteneur de marketplace : créer un plugin, le vérifier, puis publier une nouvelle version sans oublier un des fichiers qui la portent.

## Installation

```sh
claude plugin install atelier-plugins@formation-claudecode
```

## Contenu

| Composant | Emplacement | Rôle |
| --- | --- | --- |
| Skill `creer-plugin` | `skills/creer-plugin/` | Cadrage, inventaire et reprise de composants existants (skills, sous-agents, commandes) dans un nouveau plugin, inscrit au catalogue. |
| Script `creer.mjs` | `skills/creer-plugin/scripts/` | Crée `plugins/<nom>/`, copie les composants, ajoute l’entrée au catalogue sans reformater le fichier. |
| Skill `publier-plugin` | `skills/publier-plugin/` | Validation, choix du niveau de version, changelog, commit et push avec l’accord de l’utilisateur. |
| Script `valider.mjs` | `skills/publier-plugin/scripts/` | Vérifie catalogue, manifestes, skills (description, liens), agents, commandes, hooks (événements, `${CLAUDE_PLUGIN_ROOT}`, scripts présents), `.mcp.json`, syntaxe des scripts et accord des versions. `--base <réf>` refuse un plugin modifié sans nouvelle version. Annote les fichiers dans GitHub Actions. |
| Script `version.mjs` | `skills/publier-plugin/scripts/` | Nouvelle version dans le manifeste et dans le catalogue, entrée datée dans le CHANGELOG ; seule la ligne de version change dans les JSON. |

`valider.mjs` complète `claude plugin validate`, la commande de Claude Code qui contrôle le schéma exact des manifestes : vous lancez les deux avant une publication.

## Utilisation

Depuis la racine d’une marketplace ouverte dans Claude Code :

- `/atelier-plugins:publier-plugin garde-fous` après une modification du plugin `garde-fous` ;
- `/atelier-plugins:creer-plugin` pour empaqueter, par exemple, les skills du dossier `.claude` d’un projet.

Vous pouvez aussi lancer les scripts à la main, avec Node.js 20 ou plus récent :

```sh
node <skill>/scripts/valider.mjs --base origin/marketplace
node <skill>/scripts/version.mjs garde-fous minor --note "Nouvelle règle npm-install-global"
node <skill>/scripts/creer.mjs mon-plugin --description "…" --depuis ../mon-projet/.claude
```

La marketplace qui héberge ce plugin exécute `valider.mjs` dans son intégration continue.
