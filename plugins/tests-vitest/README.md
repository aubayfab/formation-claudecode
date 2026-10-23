# tests-vitest

Des tests Vitest qui prouvent un comportement et donnent le même résultat à chaque exécution, y compris pour du code qui dépend du temps, du hasard, du stockage ou du Canvas.

## Installation

```sh
claude plugin install tests-vitest@formation-claudecode
```

## Contenu

| Composant | Emplacement | Rôle |
| --- | --- | --- |
| Skill `ecrire-tests` | `skills/ecrire-tests/` | Procédure : comportements listés avant le code, un test par comportement, exécution, lecture du résultat ; reproduction d’un bug par un test rouge. |
| Script `rapport-vitest.mjs` | `skills/ecrire-tests/scripts/` | Lance Vitest et résume le résultat en quelques lignes : un échec = `fichier:ligne`, nom, message. Codes de sortie 0 / 1 / 2. |
| Référence `patterns.md` | `skills/ecrire-tests/references/` | Faux timers, `requestAnimationFrame` en environnement `node`, hasard, `localStorage`, DOM et Canvas : des exemples vérifiés sous Vitest 4. |
| Skill `conventions-vitest` | `skills/conventions-vitest/` | Conventions courtes. Son champ `paths` la limite aux fichiers `*.test.*` et `*.spec.*` : Claude la charge de lui-même quand il travaille sur l’un d’eux. Elle n’apparaît pas dans le menu `/`. |
| Sous-agent `testeur` | `agents/testeur.md` | N’écrit que des tests ; rend la main avec un test rouge qui prouve le bug. |

Un plugin Claude Code ne livre pas de fichiers de règles (`.claude/rules/`). Les conventions de test sont donc une skill : son champ `paths` en limite le chargement aux fichiers de test.

## Utilisation

- `/tests-vitest:ecrire-tests src/scores/scoreStore.ts` dans une session, ou simplement « écris les tests de scoreStore » : Claude charge la skill d’après sa description.
- Pour un bug : demandez au sous-agent `testeur` (« utilise le sous-agent testeur pour reproduire ce bug », ou `@agent-tests-vitest:testeur`). Une fois le test rouge obtenu, demandez la correction dans la conversation principale.
- Le script se lance aussi à la main, depuis la racine d’un projet : `node <dossier de la skill>/scripts/rapport-vitest.mjs [fichiers] [--nom motif]`. Une fois le plugin installé, la skill se trouve sous `~/.claude/plugins/cache/formation-claudecode/tests-vitest/<version>/skills/ecrire-tests/`.

## Prérequis

Node.js 20 ou plus récent, Vitest installé dans le projet (`npm install`).
