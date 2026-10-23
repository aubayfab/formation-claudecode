# Marketplace de la formation Claude Code

Des plugins Claude Code : des garde-fous pour Claude, des tests fiables, l’outillage pour publier vos propres plugins et la création de mini-jeux.

Cette branche (`marketplace`) ne contient que la marketplace : le catalogue [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) et les plugins qu’il référence, dans [`plugins/`](plugins).

## Plugins

| Plugin | Composants | À quoi il sert |
| --- | --- | --- |
| [garde-fous](plugins/garde-fous) | hook `PreToolUse` | Refuse ou soumet à confirmation les commandes destructrices, la lecture et l’envoi de secrets, et la modification de la configuration de Claude Code. Chaque décision cite sa règle et propose une alternative. |
| [tests-vitest](plugins/tests-vitest) | 2 skills, sous-agent | Des tests Vitest déterministes, même quand le code dépend du temps, du hasard, du stockage ou du Canvas ; un rapport de tests court ; un sous-agent testeur qui ne touche pas au code de production. |
| [atelier-plugins](plugins/atelier-plugins) | 2 skills | Créer un plugin, valider la marketplace, publier une nouvelle version sans oublier de fichier. |
| [creation-jeu](plugins/creation-jeu) | skill | Crée un mini-jeu jouable dans le navigateur (Canvas 2D) à partir d’une demande comme « fais-moi un casse-briques » : boucle de jeu, contrôles, difficulté, effets arcade, meilleurs scores. |

Les versions à jour sont dans le catalogue et dans le `CHANGELOG.md` de chaque plugin.

## Ajouter la marketplace

La marketplace est la branche `marketplace` du dépôt `aubayfab/formation-claudecode`. Sa référence s’écrit `aubayfab/formation-claudecode#marketplace`, et son nom, une fois ajoutée, est `formation-claudecode`. Avec un fork, remplacez `aubayfab` par votre compte.

```sh
claude plugin marketplace add aubayfab/formation-claudecode#marketplace
claude plugin marketplace list
claude plugin install garde-fous@formation-claudecode
claude plugin list
```

Dans une session, `/plugin marketplace add aubayfab/formation-claudecode#marketplace` fait la même chose, et `/plugin` ouvre le catalogue pour parcourir et installer les plugins.

### Pour toute une équipe

Un dépôt peut recommander la marketplace et ses plugins à tous ceux qui l’ouvrent, dans `.claude/settings.json` :

```json
{
  "extraKnownMarketplaces": {
    "formation-claudecode": {
      "source": { "source": "github", "repo": "aubayfab/formation-claudecode", "ref": "marketplace" }
    }
  },
  "enabledPlugins": {
    "garde-fous@formation-claudecode": true
  }
}
```

Les plugins de cette marketplace ont une source en chemin relatif : ils sont dans le dépôt de la marketplace. Claude Code charge donc un plugin activé dans les réglages du projet depuis la marketplace, sans installation préalable sur la machine.

## Mettre à jour

Claude Code met à jour un plugin quand sa nouvelle version est poussée sur la branche `marketplace`.

```sh
claude plugin marketplace update formation-claudecode
claude plugin update garde-fous@formation-claudecode
```

La nouvelle version est chargée à la session suivante, ou tout de suite avec `/reload-plugins` dans une session ouverte. Une marketplace ajoutée par vos soins ne se met à jour d’elle-même que si l’option d’auto-update est activée pour elle (onglet **Marketplaces** de `/plugin`).

## Sécurité

Un plugin exécute du code avec vos droits : ses hooks à chaque appel d’outil, ses serveurs MCP dès son activation. Lisez un plugin avant de l’installer ; ceux de cette marketplace documentent dans leur README ce qu’ils exécutent et ce qu’ils envoient hors de la machine.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md). Concrètement : `npm test`, `npm run valider`, une nouvelle version pour chaque plugin modifié. L’intégration continue refuse un plugin modifié dont la version n’a pas changé.
