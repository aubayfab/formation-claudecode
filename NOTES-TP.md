# TP N°1 – Prise en main de la borne d’arcade

> Avant d’écrire, que cherche-t-il et quels fichiers lit-il ?

> Qu’a-t-il décidé seul ?

> A-t-il vérifié son travail, ou simplement annoncé qu’il avait fini ?

> Après la correction « au format Xm Ys », repart-il de zéro, ou de ce qu’il a déjà écrit ?

> Avec la demande précise, qu’est-ce qui change : fichiers lus, choix laissés au modèle, vérification ?

Problèmes rencontrés :

# TP N°2 – Mon premier bug

> Collez ici les scores copiés depuis la borne :

> Comment Claude a-t-il trouvé le fichier fautif ?

> Dans le plan, sur quoi repose le diagnostic ?

> Le test échoue-t-il pour la bonne raison ? Comparez ses données avec les scores collés plus haut.

Problèmes rencontrés :

# TP N°3 – Des agents outillés

> Pourquoi Claude Code demande-t-il cette approbation ?

> Vos trois relevés de /context (avant connexion, après connexion, après les coups joués) :

> Combien d’outils ajoutent ces serveurs ? Où /context les compte-t-il ? De combien le total bouge-t-il ?

> Quels outils a-t-il appelés ? Que lui renvoie browser_snapshot ?

> Des serveurs ou de leurs réponses, qu’est-ce qui a le plus rempli le contexte ?

> D’où vient la réponse : du serveur de documentation, du web ou de la mémoire du modèle ? Comment le savez-vous ?

> Fallait-il un MCP pour ces deux tâches ?

Problèmes rencontrés :

# TP N°4 – Des agents compétents

> La skill a-t-elle été chargée ? Le classement vous paraît-il crédible ?

> Quelles entrées viennent du dépôt ? Sous quel nom la skill apparaît-elle, avec quelle description ?

> Lancée sous ce nom, que fait l’agent ? Pourquoi l’appel manuel fonctionne-t-il ?

> Le classement rendu à l’étape 1, puis après correction :

> Votre description corrigée :

> Après correction, la skill se déclenche-t-elle ? Le classement a-t-il changé depuis l’étape 1 ? Pourquoi ?

> Votre format-2025.md, et le classement 2025 obtenu :

> Laquelle des deux demandes a fait ouvrir format-2025.md ? Pourquoi pas l’autre ?

> Que mesure la ligne Skills de /context ?

Problèmes rencontrés :

# TP N°5 – Des agents bien informés

> Collez ici votre .claude/rules/tests.md :

> À quel moment la règle est-elle entrée dans le contexte ? Quel fichier l’a déclenchée ?

> Les tests suivent-ils le format demandé ?

> Avec le motif "**/*.spec.ts", la règle est-elle chargée ? Qu’est-ce qui vous l’indique ?

> Pourquoi une règle ciblée plutôt qu’une ligne dans CLAUDE.md ?

Problèmes rencontrés :

# TP N°7 – Un prompt digne de ce nom

> Copiez ici votre prompt amélioré :

> Copiez ici le contenu du report.md :

Problèmes rencontrés :

# TP N°8 – Des actions approuvées

> À la vérification initiale, quel outil chaque demande d’accord affichait-elle ?

> Copiez ici vos règles de permission :

> Dans quel fichier /permissions enregistre-t-il vos règles ?

Problèmes rencontrés :

# TP N°9 – Un spécialiste

> Collez ici le bloc rendu par /check-report pour vos deux rapports :

|                                               | Premier essai | Agent seul |
| --------------------------------------------- | ------------- | ---------- |
| Règles écrites dans le livrable (nombre brut) |               |            |
| Règles importantes retrouvées, sur 31         |               |            |
| Règles partielles (non comptées)              |               |            |
| Sources exactes, sur 31                       |               |            |
| Règles fausses (contredisent le référentiel)  |               |            |
| Anomalies signalées, sur 4                    |               |            |
| Coût relatif de la session (1er essai = 1)    |               |            |
| Contexte occupé en fin de tâche (/context)    |               |            |

Problèmes rencontrés :

# TP N°10 – Une équipe de professionnels

> Collez ici le bloc rendu par /check-report pour le livrable de l'équipe :

|                                               | Équipe |
| --------------------------------------------- | ------ |
| Règles écrites dans le livrable (nombre brut) |        |
| Règles importantes retrouvées, sur 31         |        |
| Règles partielles (non comptées)              |        |
| Sources exactes, sur 31                       |        |
| Règles fausses (contredisent le référentiel)  |        |
| Anomalies signalées, sur 4                    |        |
| Coût relatif de la session (1er essai = 1)    |        |
| Contexte occupé en fin de tâche (/context)    |        |

> Copiez ici votre orchestrateur :

> Copiez ici votre explorateur :

> Copiez ici votre scanner de cas limites :

> Copiez ici votre vérificateur :

> Copiez ici votre analyste :

Problèmes rencontrés :

# TP N°11 – Des scripts sur évènements

> Quels évènements déclenchent les hooks ?

> Comment est architecturé le hook ?

> Quel est le comportement de l’agent quand on lui demande de lire le fichier ?

> Quel est le comportement de l’agent avec cette commande shell ? Pourquoi diffère-t-il du précédent ?

> Quelles sont les pistes de résolution ?

Problèmes rencontrés :

# TP N°12 – Des compétences spécifiques

> Comment s’est comporté le modèle dans ses estimations ? Les couleurs ont-elles été respectées ou dénaturées ?

> Comment s'est comporté l'agent avec sa skill ?

> Copiez ici votre SKILL.md:

Problèmes rencontrés :

# TP N°13 – Un agent sous influence

> Remarquez-vous quelque chose de particulier ?

> Est-ce que ce comportement était bien intégré aux règles du tournois ?

> Quelle est la cause ?

> Quel est le risque d’une injection d’instructions et comment s’en prémunir ?

> D'où sortent ces mots de passe ? Comment sont-ils arrivés sur le serveur d’un attaquant ?

> Quel est le risque posé par l’exécution de MCP en local et comment s’en prémunir ?

Problèmes rencontrés :

# TP N°14 - Les marketplaces

> Où se trouve le script rapport-vitest.mjs qui a été exécuté ?

> Pourquoi cette lecture a échoué, d’où sort ce hook ?

> Quelles modifications cette skill a-t-elle automatisées ?

Problèmes rencontrés :

# TP N°15 – Faites votre propre MCP

> Quel module serveur_scores.py importe-t-il ?

> Le serveur démarre-t-il avec uv run serveur_scores.py ?

> Le client reçoit-il une erreur de protocole ou un résultat ? Qu’en fera le modèle ?

Problèmes rencontrés :

# TP N°16 – Évaluer et améliorer une skill

> Quels critères peuvent être scriptés ?

> Un seul model-grader pour les autres critères : qu'y gagne-t-on, qu'y perd-on ?

> Copiez ici votre grille d’évaluation (notes de la version 1.0.0 et de votre version) :

> Avez-vous réussi à améliorer votre skill ? Quels critères avez-vous améliorés ?

Problèmes rencontrés :
