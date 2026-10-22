---
name: evaluer-creer-jeu
description: Évalue la skill creer-jeu. Fait générer un jeu par prompt de evaluation/prompts.json dans des clones de la borne, note chaque jeu avec le script-grader et le model-grader, calcule les totaux pondérés et compare avec une version précédente. À utiliser pour évaluer ou réévaluer la skill creer-jeu.
argument-hint: <version évaluée, ex. v1> [version à comparer, ex. v1]
---

# Évaluer la skill creer-jeu

Tu orchestres : tu ne codes aucun jeu, tu ne notes rien toi-même et tu ne calcules aucun total de tête. Les notes viennent des graders, les totaux du script.

Tous les chemins sont relatifs à la racine du projet. `<version>` est le premier argument (par exemple `v1`) ; `<travail>` est `.travail-evaluation/<version>/`.

| Rôle | Chemin |
| --- | --- |
| Prompts à évaluer | `evaluation/prompts.json` |
| Script-grader (C9, C11) | `evaluation/script-grader.mjs` |
| Model-grader (C1 à C8, C10, C12) | agent `model-grader` (`.claude/agents/model-grader.md`) |
| Coefficients | `.claude/skills/evaluer-creer-jeu/coefficients.json` |
| Totaux | `.claude/skills/evaluer-creer-jeu/scripts/calculer-totaux.mjs` |

## Étape 0 : préalables

1. Lis `evaluation/prompts.json` (tableau de demandes). S'il est absent ou vide, arrête-toi.
2. Vérifie que la skill `creer-jeu` figure dans ta liste de skills (celle d'un plugin ou celle de `.claude/skills/`). Sinon, arrête-toi et réponds : « Génération arrêtée : la skill creer-jeu n'existe pas. »
3. Si `<travail>` existe déjà, arrête-toi : chaque version a son propre dossier.
4. Si `.travail-evaluation/` n'est pas dans `.gitignore`, ajoute-le.

## Étape 1 : cloner les bornes

Pour chaque demande `n` (à partir de 1) :

1. Choisis un identifiant `<id>` en minuscules, sans accent, avec des tirets (`casse-briques`, `demineur`, `pong`). Si `src/games/<id>/` existe déjà, garde cet identifiant : le jeu remplacera l'écran d'attente.
2. `git clone . "<travail>/clones/<n>-<id>"`, puis `npm install --no-audit --no-fund` dans ce clone.
3. Crée `<travail>/resultats/<n>-<id>/` : les résultats sont toujours écrits ici, jamais dans le clone.

## Étape 2 : générer les jeux

Lance un sous-agent par clone, tous dans le même message pour qu'ils travaillent en parallèle. Consigne, à compléter pour chaque clone :

```text
Tu implémentes un jeu d'arcade dans une borne clonée : <chemin absolu du clone>. Tu ne travailles que dans ce dossier.
Demande : « <demande, mot pour mot> »
Identifiant du jeu : <id> (dossier src/games/<id>/ ; s'il contient un écran d'attente, remplace-le).

1. Charge d'abord la skill creer-jeu, quel que soit le dossier où elle se trouve, et suis-la. Si elle n'existe pas, ne fais rien d'autre et réponds uniquement : STATUT: SKILL_ABSENTE
2. Aucun navigateur ni outil web. Vérifie avec npx tsc --noEmit et npm test dans le clone.
3. Ne lis ni le dossier evaluation/ ni .claude/agents/ du projet. Ni commit, ni push, ni nouvelle dépendance.
4. Termine par la liste des fichiers créés ou modifiés, puis une dernière ligne : STATUT: OK ou STATUT: ECHEC.
```

Si un sous-agent répond `STATUT: SKILL_ABSENTE`, arrête toute l'évaluation et signale-le. Un jeu en `ECHEC` est évalué quand même : c'est un résultat de la skill.

## Étape 3 : noter chaque clone

Pour chaque clone, `<clone>` désignant `<travail>/clones/<n>-<id>` et `<resultats>` désignant `<travail>/resultats/<n>-<id>` :

1. Note l'état du clone : `git -C "<clone>" status --porcelain > "<resultats>/avant.txt"`.
2. **Script-grader** : `node evaluation/script-grader.mjs "<clone>" <id> > "<resultats>/script.json"`. Code de sortie 2 : marque le clone « non évalué » et passe au suivant.
3. **Model-grader** : lance l'agent `model-grader` en sous-agent, avec la consigne : « Évalue le jeu <id> du clone situé à <chemin absolu du clone>. Les chemins de ta consigne sont relatifs à ce clone. » Les notations des différents clones peuvent tourner en parallèle.
   - Enregistre sa réponse complète dans `<resultats>/modele.md`.
   - Si l'objet JSON final manque ou s'il n'a pas les dix notes C1 à C8, C10 et C12, relance-le une fois. Si l'échec se répète, garde la dernière réponse : le script de totaux signalera l'évaluation comme incomplète.
4. Compare `git -C "<clone>" status --porcelain` avec `avant.txt`. S'ils diffèrent, la notation a modifié le clone : signale-la comme suspecte.

## Étape 4 : totaux

```sh
node .claude/skills/evaluer-creer-jeu/scripts/calculer-totaux.mjs .travail-evaluation/<version>
```

S'il y a une version à comparer (second argument), ajoute `--comparer .travail-evaluation/<version précédente>`. Le script écrit `totaux.md` et `totaux.json` dans `<travail>` et affiche `totaux.md`.

## Étape 5 : synthèse

Réponds avec :

1. Le tableau `totaux.md` : note de chaque critère et total sur 100 par jeu, moyennes.
2. Les trois critères les plus faibles, avec les raisons du model-grader et les détails du script-grader qui les expliquent.
3. Si une comparaison a été faite : les critères qui progressent et ceux qui reculent.
4. Les anomalies : évaluations incomplètes, notations suspectes, jeux en échec.
5. Le chemin de `<travail>`.
