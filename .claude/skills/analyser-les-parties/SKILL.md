---
name: setup-env
description: Installe Node 22 et les dépendances de la borne. À utiliser au premier clone du dépôt ou quand npm install échoue.
---

# Analyser les parties de la borne

## Source

`data/parties.jsonl` : une ligne par partie, heure UTC.
Convertir en heure de Paris avant de regrouper par jour.

## Lignes à exclure

- `joueurs: 0` : mode démo de la borne
- `duree_ms` sous 15000 : pièce insérée par erreur
- `jeu: "menu"` : écran de sélection des jeux

## Restitution

Un tableau trié, puis le nombre de lignes exclues par filtre.
Pour une période antérieure à 2026, lire `format-2025.md`.
