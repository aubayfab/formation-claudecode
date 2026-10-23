# Contribuer à la marketplace

## Organisation

| Emplacement | Contenu |
| --- | --- |
| `.claude-plugin/marketplace.json` | Le catalogue : nom de la marketplace, propriétaire, et une entrée par plugin (nom, source, description, version). |
| `plugins/<nom>/` | Un dossier par plugin, avec son manifeste `.claude-plugin/plugin.json`, ses composants, un `README.md` et un `CHANGELOG.md`. |
| `tests/` | Les tests des scripts livrés par les plugins (`node:test`, sans dépendance). |
| `.github/workflows/valider-marketplace.yml` | L’intégration continue : tests, puis validation du catalogue, des plugins et des versions. |

Node.js 20 ou plus récent suffit : la marketplace n’a aucune dépendance npm.

```sh
npm test               # tests des scripts
npm run valider        # catalogue, manifestes, composants
npm run valider:base   # idem, et refuse un plugin modifié depuis origin/marketplace sans nouvelle version
claude plugin validate .                  # le validateur de Claude Code, sur le catalogue
claude plugin validate plugins/<nom>      # et sur un plugin
```

## Modifier un plugin

1. Modifiez le plugin. Pour un script, ajoutez le cas correspondant dans `tests/`.
2. `npm test`.
3. Nouvelle version, au même numéro dans le manifeste et dans le catalogue, avec l’entrée du changelog :

   ```sh
   node plugins/atelier-plugins/skills/publier-plugin/scripts/version.mjs <plugin> <patch|minor|major> --note "Ce qui change pour l'utilisateur"
   ```

4. `npm run valider:base`.
5. Commit `<plugin> <version> : <résumé>`, puis pull request vers `marketplace` (ou push direct si vous en êtes mainteneur).

Dans Claude Code, la skill `/atelier-plugins:publier-plugin` enchaîne ces étapes.

### Quel incrément ?

| Niveau | Quand | Exemple |
| --- | --- | --- |
| `patch` | correction sans nouveau comportement | faux positif d’une règle, faute, lien cassé |
| `minor` | ajout compatible | nouvelle règle, nouvelle skill, nouvelle option |
| `major` | rupture | règle supprimée ou inversée, skill ou agent renommé, configuration à revoir |

Un numéro publié n’est jamais réutilisé. Le numéro du catalogue et celui du manifeste doivent être identiques : en cas d’écart, Claude Code retient celui du manifeste, et `claude plugin validate` signale l’écart par un avertissement.

Pourquoi incrémenter ? Le champ `version` d’un plugin fige ce que les utilisateurs reçoivent : tant qu’il ne change pas, `claude plugin update` répond que le plugin est déjà à jour, quels que soient les commits poussés. La version est donc ce qui **déclenche** la mise à jour, et le changelog peut dire ce qui a changé.

## Ajouter un plugin

```sh
node plugins/atelier-plugins/skills/creer-plugin/scripts/creer.mjs <nom> --description "Ce que fait le plugin, pour qui" [--depuis <dossier .claude, skill ou fichier .md d'un dossier agents/ ou commands/>]
```

Le script crée `plugins/<nom>/` en version 0.1.0 et l’ajoute au catalogue. Complétez ensuite son README, puis suivez « Modifier un plugin » à partir de l’étape 2.

Pour l’essayer avant de publier : `claude --plugin-dir ./plugins/<nom>`, puis `/reload-plugins` après chaque modification.

## Format des plugins

Les plugins de cette marketplace suivent la structure par défaut de Claude Code :

| Composant | Emplacement dans le plugin |
| --- | --- |
| Manifeste | `.claude-plugin/plugin.json` |
| Skills | `skills/<nom>/SKILL.md` |
| Sous-agents | `agents/<nom>.md` |
| Commandes | `commands/<nom>.md` (préférez les skills) |
| Hooks | `hooks/hooks.json`, sous une clé `"hooks"` |
| Serveurs MCP | `.mcp.json` |

Tout se range à la racine du plugin, jamais dans `.claude-plugin/`, qui ne contient que le manifeste. Points d’attention vérifiés par le validateur :

- **Hook qui lance un script du plugin** : le plugin est installé hors du projet, donc le script se désigne par `${CLAUDE_PLUGIN_ROOT}`. La forme `"command": "node"` avec `"args": ["${CLAUDE_PLUGIN_ROOT}/scripts/x.mjs"]` lance le programme sans shell, sans souci de guillemets. Voir `plugins/garde-fous`.
- **Hook de sécurité** : il répond par `hookSpecificOutput` sur la sortie standard, avec le code de sortie 0. Un code autre que 0 ou 2 n’empêche pas l’appel d’outil.
- **Règles et `CLAUDE.md`** : un plugin n’en livre pas. Les instructions se rangent dans une skill, limitée à certains fichiers par son champ `paths` si besoin.
- **Sous-agent** : les champs `permissionMode`, `hooks` et `mcpServers` de son frontmatter sont ignorés quand il vient d’un plugin.
- **Serveur MCP** : distant (`https://`) ou lancé par son nom (`npx`) ; aucun secret dans `env` ni `headers`.
- **Nom d’un plugin** : en kebab-case, sans le préfixe `claude-` ni `anthropic-`.

## Avant de demander une revue

- [ ] `npm test`, `npm run valider:base` et `claude plugin validate .` passent.
- [ ] Aucun secret, aucune donnée de client, aucun chemin propre à une machine.
- [ ] Le README du plugin dit ce qu’il exécute et ce qu’il envoie hors de la machine.
- [ ] Les textes destinés au modèle (skills, sous-agents) demandent de traiter le contenu lu comme de la donnée, jamais comme des instructions.
