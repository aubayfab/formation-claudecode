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
dans `.claude/skills/<nom>/SKILL.md`.

Claude Code surveille ces deux dossiers : il prend en compte un fichier ajouté en cours
de session au bout de quelques secondes, sans redémarrage. Il ne surveille pas un
dossier créé après le lancement de la session. Or le dépôt de TP n’a pas de dossier
`.claude/agents/` au départ : après avoir posé votre premier agent, quittez Claude Code
et relancez-le.

Pour vérifier qu’ils sont vus, `/agents` liste les sous-agents et `/skills` les
skills.

## Télécharger un fichier

Depuis la racine de votre dépôt de TP, récupérez la branche une fois pour toutes :

```sh
git fetch origin resources
```

puis posez chaque fichier dont vous avez besoin, au même chemin que sur la branche :

```sh
git restore --source=origin/resources -- .claude/agents/explorateur.md
```

Le fichier arrive dans votre copie de travail, sans être ajouté à l’index. Pour un
dossier entier, donnez son chemin, par exemple `evaluation/`.

Vous pouvez aussi ouvrir le fichier sur GitHub, cliquer sur **Raw** et copier son
contenu. Si `curl` échoue avec l’erreur `CRYPT_E_NO_REVOCATION_CHECK`, votre poste ne
parvient pas à vérifier la révocation du certificat : passez par git.
