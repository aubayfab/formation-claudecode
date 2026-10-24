#!/usr/bin/env node
// Incrémente la version d'un plugin dans son manifeste, seul fichier qui la déclare, et
// ajoute l'entrée datée du jour à son CHANGELOG.md. Le catalogue de la marketplace ne
// déclare pas de version : Claude Code lit d'abord celle de plugin.json, et la
// documentation déconseille de la déclarer aux deux endroits.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
  aujourdhui,
  comparerVersions,
  dossierDeSource,
  estSemver,
  incrementer,
  lireJson,
  modifierChampJson,
  MANIFESTE,
  trouverManifeste,
  trouverMarketplace,
} from './marketplace.mjs';

const AIDE = `Usage : node version.mjs <plugin> <patch|minor|major|x.y.z> --note "texte" [--note …]
                        [--section <rubrique>] [--racine <dossier>]

Met à jour, d'un coup :
  - la version du manifeste du plugin (.claude-plugin/plugin.json) ;
  - son CHANGELOG.md, avec une entrée datée du jour.

La version vit dans le seul manifeste : le script refuse un plugin dont l'entrée du
catalogue déclare aussi une version. Retirez-la du catalogue d'abord.

Niveaux : patch pour un correctif (1.2.3 → 1.2.4), minor pour un ajout compatible
(1.2.3 → 1.3.0), major pour un changement incompatible (1.2.3 → 2.0.0), ou une
version explicite plus élevée que l'actuelle.

Options :
  --note <texte>       ligne du changelog, obligatoire, répétable
  --section <rubrique> Ajouté, Modifié, Corrigé, Supprimé, Déprécié ou Sécurité
                       (défaut : Corrigé pour patch, Ajouté pour minor, Modifié pour major)
  --racine <dossier>   racine de la marketplace (défaut : répertoire courant)
  --aide               affiche cette aide

Codes de sortie : 0 version mise à jour, 1 plugin introuvable ou version refusée,
2 usage incorrect.`;

const SECTIONS = ['Ajouté', 'Modifié', 'Corrigé', 'Supprimé', 'Déprécié', 'Sécurité'];
const SECTION_PAR_NIVEAU = { patch: 'Corrigé', minor: 'Ajouté', major: 'Modifié' };

function usage(message) {
  process.stderr.write(`${message}\nVoir --aide.\n`);
  process.exit(2);
}

function echec(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function lireArguments(argv) {
  const options = { positionnels: [], notes: [], section: null, racine: '.' };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (['--aide', '--help', '-h'].includes(argument)) {
      process.stdout.write(`${AIDE}\n`);
      process.exit(0);
    } else if (argument === '--note' || argument === '--section' || argument === '--racine') {
      const valeur = argv[++i];
      if (!valeur) usage(`${argument} attend une valeur.`);
      if (argument === '--note') options.notes.push(valeur.trim());
      else options[argument.slice(2)] = valeur;
    } else if (argument.startsWith('--')) {
      usage(`Option inconnue : ${argument}.`);
    } else {
      options.positionnels.push(argument);
    }
  }
  return options;
}

const options = lireArguments(process.argv.slice(2));
const [nom, niveau] = options.positionnels;
if (!nom || !niveau || options.positionnels.length > 2) usage('Attendu : le nom du plugin et un niveau (patch, minor, major) ou une version.');
if (!['patch', 'minor', 'major'].includes(niveau) && !estSemver(niveau)) usage(`Niveau ou version invalide : ${niveau}.`);
if (options.notes.length === 0 || options.notes.some((note) => !note)) usage('--note est obligatoire : dites ce qui change pour les utilisateurs du plugin.');
if (options.section && !SECTIONS.includes(options.section)) usage(`Rubrique inconnue : ${options.section} (${SECTIONS.join(', ')}).`);

const racine = resolve(options.racine);
const marketplace = trouverMarketplace(racine);
if (!marketplace) echec(`Aucun catalogue de marketplace dans ${racine}.`);

const { donnees: catalogue } = lireJson(marketplace.chemin);
const index = (catalogue.plugins ?? []).findIndex((entree) => entree?.name === nom);
if (index < 0) echec(`Plugin « ${nom} » absent du catalogue ${marketplace.relatif}.`);
if (catalogue.plugins[index].version !== undefined) {
  echec(
    `L'entrée « ${nom} » du catalogue ${marketplace.relatif} déclare une version : retirez-la. ` +
      `La version vit dans ${MANIFESTE}, que Claude Code lit en premier.`,
  );
}
const dossier = dossierDeSource(racine, catalogue.plugins[index].source);
if (!dossier || !existsSync(dossier)) echec(`« ${nom} » n'est pas un plugin local de cette marketplace : sa version se gère dans son propre dépôt.`);
const manifestePlugin = trouverManifeste(dossier);
if (!manifestePlugin) echec(`Aucun manifeste dans ${relative(racine, dossier)} (attendu : .claude-plugin/plugin.json).`);

const cheminManifeste = manifestePlugin.chemin;
const { texte: texteManifeste, donnees: manifeste } = lireJson(cheminManifeste);
const actuelle = manifeste.version;
if (actuelle === undefined) {
  echec(`${MANIFESTE} de « ${nom} » ne déclare pas de version : ses utilisateurs suivent les commits. Ajoutez « "version": "x.y.z" » pour publier par numéro.`);
}
if (!estSemver(actuelle)) echec(`Version actuelle « ${actuelle} » non sémantique : corrigez-la à la main d'abord.`);
const nouvelle = estSemver(niveau) ? niveau : incrementer(actuelle, niveau);
if (comparerVersions(nouvelle, actuelle) <= 0) echec(`La nouvelle version (${nouvelle}) doit être plus élevée que l'actuelle (${actuelle}).`);

// Manifeste : seule la ligne de version change.
const nouveauManifeste = modifierChampJson(texteManifeste, ['version'], nouvelle);

// Changelog : la nouvelle entrée se place avant la plus récente.
const cheminChangelog = join(dossier, 'CHANGELOG.md');
const section = options.section ?? SECTION_PAR_NIVEAU[niveau] ?? 'Modifié';
const entree = `## [${nouvelle}] - ${aujourdhui()}\n\n### ${section}\n\n${options.notes.map((note) => `- ${note}`).join('\n')}\n\n`;
let changelog = existsSync(cheminChangelog)
  ? readFileSync(cheminChangelog, 'utf8')
  : '# Changelog\n\nToutes les évolutions notables de ce plugin. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).\n\n';
if (changelog.includes(`## [${nouvelle}]`)) echec(`CHANGELOG.md contient déjà une entrée ${nouvelle}.`);
const premiere = changelog.search(/^## /m);
changelog = premiere < 0 ? `${changelog.trimEnd()}\n\n${entree}` : `${changelog.slice(0, premiere)}${entree}${changelog.slice(premiere)}`;

writeFileSync(cheminManifeste, nouveauManifeste);
writeFileSync(cheminChangelog, `${changelog.trimEnd()}\n`);

const afficher = (chemin) => relative(racine, chemin).replaceAll('\\', '/');
console.log(`${nom} : ${actuelle} → ${nouvelle}`);
for (const chemin of [cheminManifeste, cheminChangelog]) console.log(`  modifié : ${afficher(chemin)}`);
