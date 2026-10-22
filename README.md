# Ressources des TP — formation Claude Code

Cette branche contient les fichiers que vous téléchargez pendant les travaux
pratiques. Elle n'est pas destinée à être clonée : chaque TP vous indique le ou les
fichiers à récupérer, au moment où vous en avez besoin.

La branche de travail de la formation est `main`, qui contient la borne d'arcade.

## Ce que vous y trouvez

### `.claude/agents/`

Sept sous-agents, utilisés par les TP sur la rétro-documentation et sur l'évaluation
de skill.

| Agent | Rôle |
| --- | --- |
| `orchestrateur` | Répartit le travail entre les quatre agents ci-dessous et recopie leurs résultats, sans rien analyser lui-même |
| `explorateur` | Extrait les règles de gestion d'un fichier source, avec leur preuve |
| `scanner-cas-limites` | Cherche les règles cachées dans les cas limites |
| `verificateur` | Contre-vérifie chaque règle contre le code |
| `analyste` | Analyse transverse : doublons, contradictions, valeurs en dur |
| `retrodoc-writer` | Fait seul le travail que les cinq précédents se répartissent |
| `model-grader` | Note un jeu d'arcade sur les critères qu'un script ne sait pas mesurer |

### `.claude/skills/`

| Skill | Rôle |
| --- | --- |
| `creer-jeu` | Crée un nouveau jeu pour la borne, en Canvas 2D et TypeScript |
| `evaluer-creer-jeu` | Évalue la skill `creer-jeu` et compare deux versions |
| `contraste-wcag` | Détecte et corrige les contrastes insuffisants d'une feuille CSS |

### Fichiers de référence

- `referentiel-regles-snake.md` — les 31 règles du module Snake, qui font foi pour
  corriger les livrables de rétro-documentation. **Ne le consultez pas avant d'avoir
  lancé vos agents.**
- `evaluation/` — le script de notation déterministe et son mode d'emploi.
- `wcag/` — les scripts de contraste, hors skill, pour le TP qui les intègre.

## Où les poser

Un agent va dans `.claude/agents/<nom>.md` à la racine de votre dépôt de TP, une skill
dans `.claude/skills/<nom>/SKILL.md`. Claude Code les charge au démarrage de la
session suivante : ouvrez une nouvelle conversation après les avoir posés.

Pour vérifier qu'ils sont vus, `/agents` liste les sous-agents et `/skills` les
skills.

## Télécharger un seul fichier

Depuis la racine de votre dépôt de TP :

```sh
curl -o .claude/agents/explorateur.md \
  https://github.com/aubayfab/formation-claudecode/raw/refs/heads/resources/.claude/agents/explorateur.md
```

Ou, plus simplement, ouvrez le fichier sur GitHub et copiez son contenu.
