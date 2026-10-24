# Changelog

Toutes les évolutions notables de ce plugin. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).

## [2.0.0] - 2026-10-24

### Modifié

- La version d’un plugin vit dans son seul plugin.json : version.mjs ne modifie plus le catalogue et refuse une entrée qui déclare une version.
- valider.mjs signale une version déclarée dans le catalogue, et un plugin sans version.
- creer.mjs n’inscrit plus de version dans le catalogue.

## [1.0.0] - 2026-10-06

### Ajouté

- Skill `creer-plugin` et script `creer.mjs`.
- Skill `publier-plugin`, scripts `valider.mjs` et `version.mjs`.
