#!/usr/bin/env node
// Crée un plugin Claude Code dans une marketplace et l'inscrit au catalogue ; peut y
// copier des skills, sous-agents et commandes existants, par exemple ceux du dossier
// .claude d'un projet.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { ajouterAuTableau, aujourdhui, lireFrontmatter, lireJson, trouverMarketplace } from '../../publier-plugin/scripts/marketplace.mjs';

const AIDE = `Usage : node creer.mjs <nom> --description "texte" [--depuis <chemin>]… [--racine <dossier>]

Crée plugins/<nom>/ en version 0.1.0 et l'inscrit au catalogue de la marketplace :
.claude-plugin/plugin.json, README.md, CHANGELOG.md, et les composants copiés depuis
chaque --depuis :

  dossier contenant un SKILL.md       → skills/<dossier>/
  fichier .md d'un dossier agents/    → agents/<fichier>
  fichier .md d'un dossier commands/  → commands/<fichier>
  dossier .claude                     → ses skills/, agents/ et commands/

Ne sont pas copiés : les hooks (leur commande doit être réécrite pour désigner les
scripts du plugin par \${CLAUDE_PLUGIN_ROOT}, voir la skill creer-plugin), les règles
de .claude/rules/ (un plugin n'en livre pas : à réécrire en skill) et CLAUDE.md.

Options :
  --description <texte>  ce que fait le plugin et pour qui (obligatoire)
  --depuis <chemin>      composant ou dossier .claude à copier, répétable
  --racine <dossier>     racine de la marketplace (défaut : répertoire courant)
  --aide                 affiche cette aide

Codes de sortie : 0 plugin créé, 1 nom déjà pris ou source invalide, 2 usage incorrect.`;

function usage(message) {
  process.stderr.write(`${message}\nVoir --aide.\n`);
  process.exit(2);
}

function echec(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function lireArguments(argv) {
  const options = { nom: null, description: null, depuis: [], racine: '.' };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (['--aide', '--help', '-h'].includes(argument)) {
      process.stdout.write(`${AIDE}\n`);
      process.exit(0);
    } else if (['--description', '--depuis', '--racine'].includes(argument)) {
      const valeur = argv[++i];
      if (!valeur) usage(`${argument} attend une valeur.`);
      if (argument === '--depuis') options.depuis.push(valeur);
      else options[argument.slice(2)] = valeur;
    } else if (argument.startsWith('--')) {
      usage(`Option inconnue : ${argument}.`);
    } else if (options.nom) {
      usage(`Argument en trop : ${argument}.`);
    } else {
      options.nom = argument;
    }
  }
  return options;
}

const avertissements = [];

/** Fichiers .md d'un dossier, un composant par fichier. */
function fichiersMd(base, type, dossierCible) {
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((nom) => nom.endsWith('.md'))
    .map((nom) => ({ type, source: join(base, nom), cible: join(dossierCible, nom), nom: basename(nom, '.md') }));
}

/** Composants à copier : [{ type, source, cible, nom }], cibles relatives au dossier du plugin. */
function composantsDepuis(chemin) {
  if (!existsSync(chemin)) echec(`Introuvable : ${chemin}`);
  const nom = basename(chemin);
  if (statSync(chemin).isDirectory()) {
    if (existsSync(join(chemin, 'SKILL.md'))) {
      const { champs } = lireFrontmatter(readFileSync(join(chemin, 'SKILL.md'), 'utf8'));
      const nomSkill = nom;
      if (champs?.name && champs.name !== nom) {
        avertissements.push(`skill ${nom} : « name: ${champs.name} » remplacera le nom du dossier dans la commande ; gardez-les identiques.`);
      }
      return [{ type: 'skill', source: chemin, cible: join('skills', nomSkill), nom: nomSkill }];
    }
    if (nom === '.claude') {
      const skills = existsSync(join(chemin, 'skills'))
        ? readdirSync(join(chemin, 'skills'))
            .filter((element) => existsSync(join(chemin, 'skills', element, 'SKILL.md')))
            .flatMap((element) => composantsDepuis(join(chemin, 'skills', element)))
        : [];
      if (existsSync(join(chemin, 'rules'))) {
        avertissements.push('.claude/rules/ n’est pas repris : un plugin ne livre pas de règles. Réécrivez chacune en skill, avec « paths » pour la limiter à certains fichiers.');
      }
      return [
        ...skills,
        ...fichiersMd(join(chemin, 'agents'), 'agent', 'agents'),
        ...fichiersMd(join(chemin, 'commands'), 'commande', 'commands'),
      ];
    }
    echec(`${chemin} : ni une skill (pas de SKILL.md), ni un dossier .claude.`);
  }
  if (nom.endsWith('.md')) {
    const parent = basename(dirname(chemin));
    if (parent === 'agents') return [{ type: 'agent', source: chemin, cible: join('agents', nom), nom: basename(nom, '.md') }];
    if (parent === 'commands') return [{ type: 'commande', source: chemin, cible: join('commands', nom), nom: basename(nom, '.md') }];
  }
  echec(`${chemin} : type de fichier non pris en charge (fichier .md d'un dossier agents/ ou commands/, ou dossier de skill).`);
}

const options = lireArguments(process.argv.slice(2));
const { nom, description } = options;
if (!nom) usage('Attendu : le nom du plugin.');
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(nom) || nom.length > 64) usage(`Nom invalide : ${nom} (kebab-case : minuscules, chiffres et tirets simples, 64 caractères au plus).`);
if (!description?.trim()) usage('--description est obligatoire.');

const racine = resolve(options.racine);
const marketplace = trouverMarketplace(racine);
if (!marketplace) echec(`Aucun catalogue de marketplace dans ${racine} (attendu : .claude-plugin/marketplace.json).`);
const { texte: texteCatalogue, donnees: catalogue } = lireJson(marketplace.chemin);
if ((catalogue.plugins ?? []).some((entree) => entree?.name === nom)) echec(`Le catalogue contient déjà un plugin « ${nom} ».`);
const dossier = join(racine, 'plugins', nom);
if (existsSync(dossier)) echec(`Le dossier ${relative(racine, dossier)} existe déjà.`);

const composants = options.depuis.flatMap((chemin) => composantsDepuis(resolve(chemin)));
const cibles = new Set();
for (const { cible } of composants) {
  if (cibles.has(cible)) echec(`Deux composants iraient au même endroit : ${cible}.`);
  cibles.add(cible);
}

mkdirSync(join(dossier, '.claude-plugin'), { recursive: true });
writeFileSync(join(dossier, '.claude-plugin', 'plugin.json'), `${JSON.stringify({ name: nom, version: '0.1.0', description }, null, 2)}\n`);
for (const { source, cible } of composants) {
  mkdirSync(dirname(join(dossier, cible)), { recursive: true });
  cpSync(source, join(dossier, cible), { recursive: true });
}

const lignes = composants.map(({ type, nom: nomComposant, cible }) => `| ${type} \`${nomComposant}\` | \`${cible.replaceAll('\\', '/')}\` |`);
const nomMarketplace = catalogue.name ?? '<marketplace>';
writeFileSync(
  join(dossier, 'README.md'),
  `# ${nom}\n\n${description}\n\n## Installation\n\n\`\`\`sh\nclaude plugin install ${nom}@${nomMarketplace}\n\`\`\`\n${lignes.length ? `\n## Contenu\n\n| Composant | Emplacement |\n| --- | --- |\n${lignes.join('\n')}\n` : ''}`,
);
const contenu = composants.length ? composants.map(({ type, nom: n }) => `${type} \`${n}\``).join(', ') : 'manifeste';
writeFileSync(
  join(dossier, 'CHANGELOG.md'),
  `# Changelog\n\nToutes les évolutions notables de ce plugin. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions : [SemVer](https://semver.org/lang/fr/).\n\n## [0.1.0] - ${aujourdhui()}\n\n### Ajouté\n\n- Première version : ${contenu}.\n`,
);

const entree = { name: nom, source: `./plugins/${nom}`, description, version: '0.1.0' };
writeFileSync(marketplace.chemin, ajouterAuTableau(texteCatalogue, ['plugins'], entree));

console.log(`Plugin ${nom} 0.1.0 créé dans ${relative(racine, dossier).replaceAll('\\', '/')} et inscrit dans ${marketplace.relatif}.`);
for (const { type, nom: nomComposant, cible } of composants) console.log(`  ${type} ${nomComposant} → ${cible.replaceAll('\\', '/')}`);
for (const avertissement of avertissements) console.log(`ATTENTION ${avertissement}`);
