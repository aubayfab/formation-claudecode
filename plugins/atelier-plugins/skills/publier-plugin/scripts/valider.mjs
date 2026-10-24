#!/usr/bin/env node
// Vérifie une marketplace de plugins Claude Code avant publication : catalogue,
// manifestes, skills, agents, commandes, hooks, serveurs MCP, scripts et versions.
//
// Complète `claude plugin validate`, sans le remplacer : ce script ajoute ce que la
// commande officielle ne contrôle pas (version déclarée dans le seul manifeste, plugin
// modifié sans nouvelle version, scripts livrés, liens des SKILL.md).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
  comparerVersions,
  dossierDeSource,
  estDans,
  estSemver,
  lireFrontmatter,
  lireJson,
  trouverManifeste,
  trouverMarketplace,
} from './marketplace.mjs';

const AIDE = `Usage : node valider.mjs [racine] [--base <référence git>] [--json]

Vérifie la marketplace dont la racine est donnée (par défaut le répertoire courant) :
  - le catalogue .claude-plugin/marketplace.json ;
  - chaque plugin local qu'il référence : .claude-plugin/plugin.json, skills, agents,
    commandes, hooks, serveurs MCP, scripts JavaScript, liens des SKILL.md ;
  - la version de chaque plugin, déclarée dans son seul plugin.json : le catalogue
    n'en déclare pas, Claude Code lisant d'abord celle du manifeste.

Options :
  --base <réf>   vérifie aussi que chaque plugin modifié depuis cette référence Git
                 (ex. origin/marketplace) a une version plus élevée qu'à cette référence
  --json         sortie JSON
  --aide         affiche cette aide

Codes de sortie : 0 aucune erreur (avertissements possibles), 1 au moins une erreur,
2 usage incorrect, marketplace ou référence Git introuvable.

Pour les contrôles de Claude Code lui-même : claude plugin validate <dossier>.`;

const NOM_KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NOM_CATALOGUE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Champs du catalogue et des entrées : documentation « Marketplace reference ».
const CHAMPS_CATALOGUE = new Set([
  '$schema', 'name', 'owner', 'plugins', 'description', 'version', 'metadata', 'forceRemoveDeletedPlugins',
  'allowCrossMarketplaceDependenciesOn', 'renames',
]);
const CHAMPS_METADATA = new Set(['description', 'version', 'pluginRoot']);
// Champs propres à l'entrée, puis champs de plugin.json acceptés dans une entrée.
const CHAMPS_ENTREE = new Set([
  'name', 'source', 'description', 'version', 'category', 'tags', 'strict', 'relevance', 'dependencies',
  'defaultEnabled', 'displayName', 'metadata', 'headers', 'headersHelper',
  'author', 'homepage', 'repository', 'license', 'keywords', 'commands', 'agents', 'skills', 'hooks',
  'mcpServers', 'lspServers', 'userConfig', 'channels', 'settings', 'outputStyles', 'themes', 'workflows', 'experimental',
]);
const TYPES_SOURCE_DISTANTE = new Set(['github', 'url', 'git-subdir', 'npm', 'archive', 'command']);

// Champs de plugin.json : documentation « Plugin manifest reference », tableau Fields.
const CHAMPS_MANIFESTE = new Set([
  '$schema', 'name', 'displayName', 'version', 'description', 'author', 'homepage', 'repository', 'license',
  'keywords', 'metadata', 'icon', 'documentationUrl', 'supportUrl', 'privacyPolicyUrl', 'termsOfServiceUrl',
  'defaultEnabled', 'dependencies', 'settings', 'userConfig', 'types', 'channels', 'skills', 'commands', 'agents',
  'hooks', 'mcpServers', 'lspServers', 'outputStyles', 'workflows', 'experimental',
]);

// Frontmatter d'une skill : documentation « Claude directory », fichiers par frontmatter.
const CHAMPS_SKILL = new Set([
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable',
  'allowed-tools', 'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  'metadata', 'license', 'compatibility',
]);
const CHAMPS_COMMANDE = new Set([...CHAMPS_SKILL].filter((champ) => champ !== 'name' && champ !== 'paths'));
// Frontmatter d'un agent livré par un plugin : documentation « Add components to a plugin ».
const CHAMPS_AGENT = new Set([
  'name', 'description', 'model', 'effort', 'maxTurns', 'autoCompactWindow', 'tools', 'disallowedTools', 'skills',
  'memory', 'background', 'omitClaudeMd', 'isolation', 'color', 'experimental',
]);
const CHAMPS_AGENT_IGNORES = new Set(['permissionMode', 'hooks', 'mcpServers', 'initialPrompt']);

// Événements de hook : documentation « Hooks reference », section Hook events.
const EVENEMENTS = new Set([
  'SessionStart', 'Setup', 'InstructionsLoaded', 'UserPromptSubmit', 'UserPromptExpansion', 'MessageDisplay',
  'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'PermissionDenied',
  'Notification', 'SubagentStart', 'SubagentStop', 'TaskCreated', 'TaskCompleted', 'Stop', 'StopFailure',
  'TeammateIdle', 'ConfigChange', 'CwdChanged', 'DirectoryAdded', 'FileChanged', 'WorktreeCreate', 'WorktreeRemove',
  'PreCompact', 'PostCompact', 'PreModelSwitch', 'PostModelSwitch', 'SessionEnd', 'Elicitation', 'ElicitationResult',
]);
const TYPES_HOOK = new Set(['command', 'http', 'mcp_tool', 'prompt', 'agent']);

const JETON_RACINE = '${CLAUDE_PLUGIN_ROOT}';
const CHEMINS_SOUS_JETON = /\$\{CLAUDE_PLUGIN_ROOT\}([\\/][^\s"'`;|&<>]+)/g;
const JETON_SANS_GUILLEMET = /(^|[^"])\$\{CLAUDE_PLUGIN_ROOT\}/;

// --- Arguments ----------------------------------------------------------------

function lireArguments(argv) {
  const options = { racine: '.', base: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];
    if (['--aide', '--help', '-h'].includes(argument)) {
      process.stdout.write(`${AIDE}\n`);
      process.exit(0);
    } else if (argument === '--base') {
      options.base = argv[++i];
      if (!options.base) quitter('--base attend une référence Git, par exemple origin/marketplace.');
    } else if (argument === '--json') {
      options.json = true;
    } else if (argument.startsWith('--')) {
      quitter(`Option inconnue : ${argument}. Voir --aide.`);
    } else {
      options.racine = argument;
    }
  }
  return options;
}

function quitter(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

// --- Collecte des problèmes ---------------------------------------------------

class Rapport {
  constructor(racine) {
    this.racine = racine;
    this.problemes = [];
  }

  #ajouter(niveau, fichier, message) {
    this.problemes.push({ niveau, fichier: relative(this.racine, fichier).replaceAll('\\', '/') || '.', message });
  }

  erreur(fichier, message) {
    this.#ajouter('erreur', fichier, message);
  }

  avertissement(fichier, message) {
    this.#ajouter('avertissement', fichier, message);
  }

  get erreurs() {
    return this.problemes.filter((p) => p.niveau === 'erreur');
  }
}

function lireJsonVerifie(rapport, chemin) {
  try {
    return lireJson(chemin).donnees;
  } catch (erreur) {
    rapport.erreur(chemin, `JSON illisible : ${erreur.message}`);
    return null;
  }
}

function estObjet(valeur) {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
}

function urlValide(texte) {
  try {
    new URL(texte);
    return true;
  } catch {
    return false;
  }
}

// --- Catalogue ------------------------------------------------------------------

function validerCatalogue(rapport, chemin) {
  const catalogue = lireJsonVerifie(rapport, chemin);
  if (!estObjet(catalogue)) {
    if (catalogue !== null) rapport.erreur(chemin, 'le catalogue doit être un objet JSON.');
    return null;
  }
  for (const champ of Object.keys(catalogue)) {
    if (!CHAMPS_CATALOGUE.has(champ)) rapport.avertissement(chemin, `champ « ${champ} » inconnu, ignoré par Claude Code.`);
  }
  const nom = catalogue.name;
  if (typeof nom !== 'string' || !NOM_CATALOGUE.test(nom) || nom.includes('..')) {
    rapport.erreur(chemin, '« name » est obligatoire : lettres, chiffres, « . », « _ » et « - », en commençant par une lettre ou un chiffre, sans « .. ».');
  }
  if (!estObjet(catalogue.owner) || typeof catalogue.owner.name !== 'string' || !catalogue.owner.name) {
    rapport.erreur(chemin, '« owner.name » est obligatoire.');
  }
  if (catalogue.metadata !== undefined && !estObjet(catalogue.metadata)) {
    rapport.erreur(chemin, '« metadata » doit être un objet { description, version, pluginRoot }.');
  } else if (estObjet(catalogue.metadata)) {
    for (const champ of Object.keys(catalogue.metadata)) {
      if (!CHAMPS_METADATA.has(champ)) rapport.avertissement(chemin, `metadata.${champ} inconnu, ignoré par Claude Code.`);
    }
  }
  if (typeof catalogue.description !== 'string' && typeof catalogue.metadata?.description !== 'string') {
    rapport.avertissement(chemin, 'pas de description de la marketplace (« description » ou « metadata.description »).');
  }
  if (!Array.isArray(catalogue.plugins)) {
    rapport.erreur(chemin, '« plugins » est obligatoire et doit être un tableau.');
    return null;
  }
  return catalogue;
}

function validerEntree(rapport, chemin, entree, index, dejaVus) {
  const ou = `plugins[${index}]`;
  if (!estObjet(entree)) {
    rapport.erreur(chemin, `${ou} doit être un objet.`);
    return false;
  }
  const nom = entree.name;
  if (typeof nom !== 'string' || !NOM_KEBAB.test(nom)) {
    rapport.erreur(chemin, `${ou} : « name » obligatoire, en kebab-case (minuscules, chiffres et tirets simples).`);
    return false;
  }
  if (dejaVus.has(nom)) rapport.erreur(chemin, `plugin « ${nom} » déclaré deux fois.`);
  dejaVus.add(nom);
  for (const champ of Object.keys(entree)) {
    if (!CHAMPS_ENTREE.has(champ)) rapport.avertissement(chemin, `${nom} : champ « ${champ} » inconnu, ignoré par Claude Code.`);
  }
  if (entree.source === undefined) rapport.erreur(chemin, `${nom} : « source » est obligatoire.`);
  if (typeof entree.description !== 'string' || !entree.description.trim()) {
    rapport.avertissement(chemin, `${nom} : sans « description », le plugin est difficile à choisir dans /plugin.`);
  }
  if (entree.version !== undefined && !estSemver(entree.version)) {
    rapport.erreur(chemin, `${nom} : version « ${entree.version} » non sémantique (attendu : majeure.mineure.correctif).`);
  } else if (entree.version !== undefined) {
    rapport.avertissement(
      chemin,
      `${nom} : version déclarée dans le catalogue. Déclarez-la dans le seul plugin.json du plugin, que Claude Code lit en premier.`,
    );
  }
  if (typeof entree.source === 'string') {
    if (entree.source !== '.' && !entree.source.startsWith('./')) {
      rapport.erreur(chemin, `${nom} : une source locale commence par « ./ » (« ${entree.source} »).`);
    }
    if (entree.source.includes('..')) rapport.erreur(chemin, `${nom} : la source « ${entree.source} » contient « .. ».`);
  } else if (estObjet(entree.source)) {
    if (!TYPES_SOURCE_DISTANTE.has(entree.source.source)) {
      rapport.erreur(chemin, `${nom} : type de source « ${entree.source.source} » inconnu (${[...TYPES_SOURCE_DISTANTE].join(', ')}).`);
    }
    const { sha } = entree.source;
    if (sha !== undefined && !/^[0-9a-f]{40}$/.test(sha)) {
      rapport.erreur(chemin, `${nom} : source.sha doit être un SHA de commit complet (40 caractères hexadécimaux minuscules).`);
    }
    rapport.avertissement(chemin, `${nom} : source distante, son contenu n’est pas vérifié ici.`);
  } else if (entree.source !== undefined) {
    rapport.erreur(chemin, `${nom} : « source » doit être un chemin relatif ou un objet { source, … }.`);
  }
  return true;
}

// --- Plugin -----------------------------------------------------------------------

function validerManifeste(rapport, manifestePlugin, entree) {
  const chemin = manifestePlugin.chemin;
  const manifeste = lireJsonVerifie(rapport, chemin);
  if (!estObjet(manifeste)) return null;
  const nom = manifeste.name;

  if (typeof nom !== 'string' || !NOM_KEBAB.test(nom)) {
    rapport.erreur(chemin, '« name » obligatoire, en kebab-case (minuscules, chiffres et tirets simples).');
  } else if (nom !== entree.name) {
    rapport.erreur(chemin, `le manifeste s’appelle « ${nom} » mais le catalogue l’annonce sous « ${entree.name} ».`);
  }
  for (const champ of Object.keys(manifeste)) {
    if (!CHAMPS_MANIFESTE.has(champ)) rapport.avertissement(chemin, `champ « ${champ} » inconnu, ignoré par Claude Code.`);
  }
  if (typeof manifeste.homepage === 'string' && !urlValide(manifeste.homepage)) {
    rapport.erreur(chemin, '« homepage » n’est pas une URL : Claude Code refuse de charger le plugin.');
  }
  if (manifeste.version === undefined) {
    if (entree.version === undefined) {
      rapport.avertissement(chemin, 'pas de « version » : les utilisateurs suivent les commits au lieu d’un numéro de version.');
    }
  } else if (!estSemver(manifeste.version)) {
    rapport.erreur(chemin, `version « ${manifeste.version} » non sémantique.`);
  } else if (entree.version !== undefined && entree.version !== manifeste.version) {
    rapport.erreur(
      chemin,
      `version ${manifeste.version} dans le manifeste, ${entree.version} dans le catalogue : Claude Code retient celle du manifeste sans prévenir. Retirez-la du catalogue.`,
    );
  }
  return manifeste;
}

function sansBlocsDeCode(texte) {
  return texte.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
}

function validerLiens(rapport, fichier, corps, dossierPlugin) {
  const texte = sansBlocsDeCode(corps);
  const cibles = [...texte.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  for (const cible of cibles) {
    if (/^([a-z][a-z0-9+.-]*:|#|~|<|\$\{)/i.test(cible)) continue;
    let chemin = cible.split('#')[0].split('?')[0];
    try {
      chemin = decodeURI(chemin);
    } catch {
      // lien déjà décodé
    }
    if (!chemin) continue;
    const resolu = resolve(dirname(fichier), chemin);
    if (!estDans(dossierPlugin, resolu)) {
      rapport.erreur(fichier, `le lien « ${cible} » sort du plugin : une fois installé, le fichier n’existera pas.`);
    } else if (!existsSync(resolu)) {
      rapport.erreur(fichier, `le lien « ${cible} » mène à un fichier absent.`);
    }
  }
}

function champsInconnus(rapport, fichier, champs, connus, ignores = new Set()) {
  for (const champ of Object.keys(champs)) {
    if (ignores.has(champ)) rapport.avertissement(fichier, `champ « ${champ} » ignoré par Claude Code pour un agent livré par un plugin.`);
    else if (!connus.has(champ)) rapport.avertissement(fichier, `champ « ${champ} » inconnu, ignoré par Claude Code.`);
  }
}

function validerSkills(rapport, dossier) {
  const base = join(dossier, 'skills');
  if (!existsSync(base) || !statSync(base).isDirectory()) return 0;
  let total = 0;
  for (const nomDossier of readdirSync(base)) {
    const fichier = join(base, nomDossier, 'SKILL.md');
    if (!existsSync(fichier)) continue;
    total++;
    const texte = readFileSync(fichier, 'utf8');
    const { champs, corps, erreur } = lireFrontmatter(texte);
    if (!champs) {
      rapport.erreur(fichier, erreur ?? 'frontmatter YAML absent : au moins « description » est attendue.');
      continue;
    }
    if (!champs.description) {
      rapport.erreur(fichier, '« description » est obligatoire ici : c’est elle qui décide quand Claude charge la skill.');
    } else if (`${champs.description}\n${champs.when_to_use ?? ''}`.length > 1536) {
      rapport.avertissement(fichier, '« description » et « when_to_use » dépassent 1 536 caractères : la fin est coupée dans la liste des skills.');
    }
    if (champs.name && champs.name !== nomDossier) {
      rapport.avertissement(fichier, `« name: ${champs.name} » remplace le nom du dossier « ${nomDossier} » dans la commande /<plugin>:<nom>.`);
    }
    if (typeof champs.compatibility === 'string' && champs.compatibility.length > 500) {
      rapport.erreur(fichier, '« compatibility » dépasse 500 caractères.');
    }
    champsInconnus(rapport, fichier, champs, CHAMPS_SKILL);
    if (texte.split('\n').length > 500) {
      rapport.avertissement(fichier, 'plus de 500 lignes : déplacez le détail dans des fichiers à part, chargés seulement au besoin.');
    }
    validerLiens(rapport, fichier, corps, dossier);
  }
  return total;
}

function fichiersMarkdown(base) {
  if (!existsSync(base) || !statSync(base).isDirectory()) return [];
  return readdirSync(base, { withFileTypes: true }).flatMap((element) => {
    const chemin = join(base, element.name);
    if (element.isDirectory()) return fichiersMarkdown(chemin);
    return element.name.endsWith('.md') ? [chemin] : [];
  });
}

function validerMarkdowns(rapport, dossier) {
  const agents = fichiersMarkdown(join(dossier, 'agents'));
  for (const fichier of agents) {
    const { champs, erreur } = lireFrontmatter(readFileSync(fichier, 'utf8'));
    if (!champs) {
      rapport.erreur(fichier, erreur ?? 'frontmatter YAML absent : « name » et « description » sont attendus, sinon l’agent est chargé avec tous ses champs ignorés.');
      continue;
    }
    if (!champs.description) rapport.erreur(fichier, 'agent sans « description » : Claude ne saurait pas quand lui déléguer une tâche.');
    if (!champs.name) rapport.avertissement(fichier, 'agent sans « name » : il prend le nom du fichier.');
    champsInconnus(rapport, fichier, champs, CHAMPS_AGENT, CHAMPS_AGENT_IGNORES);
  }
  const commandes = fichiersMarkdown(join(dossier, 'commands'));
  for (const fichier of commandes) {
    const { champs } = lireFrontmatter(readFileSync(fichier, 'utf8'));
    if (!champs?.description) rapport.avertissement(fichier, 'commande sans « description ».');
    else champsInconnus(rapport, fichier, champs, CHAMPS_COMMANDE);
  }
  return { agents: agents.length, commandes: commandes.length };
}

function entreesDeHooks(config) {
  const resultat = [];
  for (const [evenement, liste] of Object.entries(config.hooks ?? {})) {
    if (!Array.isArray(liste)) {
      resultat.push({ evenement, invalide: true });
      continue;
    }
    for (const element of liste) {
      if (!estObjet(element) || !Array.isArray(element.hooks)) {
        resultat.push({ evenement, invalide: true });
        continue;
      }
      for (const entree of element.hooks) resultat.push({ evenement, entree });
    }
  }
  return resultat;
}

function validerCommandeHook(rapport, fichier, dossier, evenement, entree) {
  if (!estObjet(entree)) {
    rapport.erreur(fichier, `${evenement} : entrée de hook invalide.`);
    return;
  }
  if (!TYPES_HOOK.has(entree.type)) {
    rapport.erreur(fichier, `${evenement} : « type » doit valoir ${[...TYPES_HOOK].join(', ')}.`);
    return;
  }
  if (entree.timeout !== undefined && !(typeof entree.timeout === 'number' && entree.timeout > 0)) {
    rapport.erreur(fichier, `${evenement} : « timeout » est un nombre de secondes positif.`);
  }
  if (entree.type !== 'command') return;
  if (typeof entree.command !== 'string' || !entree.command.trim()) {
    rapport.erreur(fichier, `${evenement} : un hook de type command a besoin de « command ».`);
    return;
  }
  const args = Array.isArray(entree.args) ? entree.args.filter((a) => typeof a === 'string') : [];
  const textes = [entree.command, ...args];
  if (!Array.isArray(entree.args) && entree.shell !== 'powershell' && JETON_SANS_GUILLEMET.test(entree.command)) {
    rapport.avertissement(
      fichier,
      `${evenement} : mettez ${JETON_RACINE} entre guillemets (ou utilisez « args ») : un chemin avec des espaces serait coupé en deux.`,
    );
  }
  for (const texte of textes) {
    for (const [, chemin] of texte.matchAll(CHEMINS_SOUS_JETON)) {
      if (!existsSync(join(dossier, chemin))) rapport.erreur(fichier, `${evenement} : « ${chemin} » n’existe pas dans le plugin.`);
    }
    for (const mot of texte.split(/[\s"']+/)) {
      if (!mot || mot.includes('${') || /^[a-z]:|^\//i.test(mot) || !/[\\/]/.test(mot)) continue;
      if (existsSync(join(dossier, mot))) {
        rapport.erreur(
          fichier,
          `${evenement} : « ${mot} » est relatif au projet de l’utilisateur, pas au plugin ; préfixez-le par ${JETON_RACINE}.`,
        );
      }
    }
  }
}

function validerHooks(rapport, dossier, manifeste) {
  const fichiers = [join(dossier, 'hooks', 'hooks.json')].filter(existsSync);
  const declares = [manifeste?.hooks].flat().filter((valeur) => typeof valeur === 'string');
  for (const declare of declares) {
    const chemin = join(dossier, declare);
    if (!existsSync(chemin)) rapport.erreur(join(dossier, '.claude-plugin', 'plugin.json'), `« hooks » désigne « ${declare} », qui n’existe pas.`);
    else fichiers.push(chemin);
  }
  for (const fichier of [...new Set(fichiers)]) {
    const config = lireJsonVerifie(rapport, fichier);
    if (!estObjet(config)) continue;
    if (!estObjet(config.hooks)) {
      rapport.erreur(fichier, '« hooks » doit être un objet { NomDÉvénement: [ … ] } : sans cette clé, Claude Code ne charge pas le fichier.');
      continue;
    }
    for (const { evenement, entree, invalide } of entreesDeHooks(config)) {
      if (invalide) {
        rapport.erreur(fichier, `${evenement} : la valeur doit être un tableau d’objets { matcher, hooks: [ … ] }.`);
        continue;
      }
      if (!EVENEMENTS.has(evenement)) rapport.avertissement(fichier, `événement « ${evenement} » inconnu de Claude Code.`);
      validerCommandeHook(rapport, fichier, dossier, evenement, entree);
    }
  }
  return new Set(fichiers).size;
}

const CLES_SECRETES = /authorization|token|key|secret|cookie|password/i;

function validerMcp(rapport, dossier, manifeste) {
  const fichier = join(dossier, '.mcp.json');
  let total = 0;
  if (existsSync(fichier)) {
    const config = lireJsonVerifie(rapport, fichier);
    if (estObjet(config)) {
      // Le fichier peut aussi se passer de l'enveloppe « mcpServers ».
      const serveurs = estObjet(config.mcpServers) ? config.mcpServers : config;
      for (const [nom, serveur] of Object.entries(serveurs)) {
        total++;
        if (!estObjet(serveur) || !(typeof serveur.command === 'string' || typeof serveur.url === 'string')) {
          rapport.erreur(fichier, `serveur « ${nom} » : « command » (serveur local) ou « url » (serveur distant) est obligatoire.`);
          continue;
        }
        for (const groupe of ['env', 'headers']) {
          for (const [cle, valeur] of Object.entries(serveur[groupe] ?? {})) {
            if (CLES_SECRETES.test(cle) && typeof valeur === 'string' && !valeur.includes('${')) {
              rapport.erreur(fichier, `serveur « ${nom} » : « ${groupe}.${cle} » contient une valeur en clair : aucun secret dans un plugin, son contenu est public.`);
            }
          }
        }
      }
    }
  }
  if (manifeste?.mcpServers !== undefined) total += 1;
  return total;
}

function fichiersJavaScript(dossier) {
  const resultat = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom !== 'node_modules' && !nom.startsWith('.git')) resultat.push(...fichiersJavaScript(chemin));
    } else if (/\.(m|c)?js$/.test(nom)) {
      resultat.push(chemin);
    }
  }
  return resultat;
}

/**
 * Syntaxe des scripts livrés (node --check). Un script de hook qui ne se charge plus
 * sort en erreur : pour Claude Code, c'est une erreur non bloquante, et le hook de
 * sécurité cesse de protéger sans que personne ne le voie.
 */
function validerSyntaxeJavaScript(rapport, dossier) {
  for (const fichier of fichiersJavaScript(dossier)) {
    const verification = spawnSync(process.execPath, ['--check', fichier], { encoding: 'utf8' });
    if (verification.status !== 0) {
      const detail = (verification.stderr ?? '').split('\n').find((ligne) => /Error/.test(ligne)) ?? 'erreur de syntaxe';
      rapport.erreur(fichier, `script JavaScript invalide : ${detail.trim()}`);
    }
  }
}

/** Fichiers ou dossiers que Claude Code ne charge pas depuis un plugin. */
function validerEmplacements(rapport, dossier) {
  if (existsSync(join(dossier, 'CLAUDE.md'))) {
    rapport.avertissement(join(dossier, 'CLAUDE.md'), 'CLAUDE.md n’est pas chargé comme contexte depuis un plugin : mettez ces instructions dans une skill.');
  }
  for (const [chemin, conseil] of [
    ['plugin.json', 'le manifeste va dans .claude-plugin/plugin.json'],
    ['rules', 'un plugin ne livre pas de règles : utilisez une skill, avec « paths » pour la limiter à certains fichiers'],
    ['com.github.copilot', 'dossier propre à GitHub Copilot, ignoré par Claude Code'],
    ['mcp.json', 'les serveurs MCP vont dans .mcp.json, à la racine du plugin'],
  ]) {
    if (existsSync(join(dossier, chemin))) rapport.avertissement(join(dossier, chemin), `emplacement non chargé par Claude Code : ${conseil}.`);
  }
}

function validerPlugin(rapport, racine, fichierCatalogue, entree) {
  const dossier = dossierDeSource(racine, entree.source);
  if (!dossier) return null;
  if (!estDans(racine, dossier)) {
    rapport.erreur(fichierCatalogue, `${entree.name} : la source « ${entree.source} » sort du dépôt.`);
    return null;
  }
  if (!existsSync(dossier) || !statSync(dossier).isDirectory()) {
    rapport.erreur(fichierCatalogue, `${entree.name} : le dossier « ${entree.source} » n’existe pas.`);
    return null;
  }
  const manifestePlugin = trouverManifeste(dossier);
  if (!manifestePlugin) {
    rapport.erreur(dossier, 'aucun manifeste : .claude-plugin/plugin.json est attendu (la version du plugin y est lue).');
    return null;
  }

  const manifeste = validerManifeste(rapport, manifestePlugin, entree);
  const composants = {
    skills: validerSkills(rapport, dossier),
    ...validerMarkdowns(rapport, dossier),
    hooks: validerHooks(rapport, dossier, manifeste),
    mcp: validerMcp(rapport, dossier, manifeste),
  };
  if (Object.values(composants).every((n) => n === 0)) {
    rapport.avertissement(dossier, 'aucun composant trouvé (skill, agent, commande, hook, serveur MCP).');
  }
  validerEmplacements(rapport, dossier);
  validerSyntaxeJavaScript(rapport, dossier);
  if (!existsSync(join(dossier, 'README.md'))) rapport.avertissement(dossier, 'pas de README.md.');
  if (!existsSync(join(dossier, 'CHANGELOG.md'))) rapport.avertissement(dossier, 'pas de CHANGELOG.md.');
  return { nom: entree.name, version: manifeste?.version ?? entree.version, dossier, manifeste: manifestePlugin.relatif, composants };
}

// --- Versions depuis une référence Git ---------------------------------------------

function git(dossier, args) {
  return execFileSync('git', args, { cwd: dossier, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function validerIncrements(rapport, racine, plugins, base) {
  let depot;
  try {
    depot = git(racine, ['rev-parse', '--show-toplevel']);
    git(racine, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  } catch {
    quitter(`Référence Git introuvable : ${base} (ou ${racine} n’est pas un dépôt Git).`);
  }
  for (const plugin of plugins) {
    const relatif = relative(depot, plugin.dossier).replaceAll('\\', '/');
    const modifies = [
      ...git(depot, ['diff', '--name-only', base, '--', relatif]).split('\n'),
      ...git(depot, ['ls-files', '--others', '--exclude-standard', '--', relatif]).split('\n'),
    ].filter(Boolean);
    if (modifies.length === 0) continue;
    let ancienne;
    try {
      ancienne = JSON.parse(git(depot, ['show', `${base}:${relatif}/${plugin.manifeste}`])).version;
    } catch {
      continue; // plugin absent à la référence : nouveau plugin
    }
    if (!estSemver(ancienne) || !estSemver(plugin.version ?? '')) continue;
    const fichier = join(plugin.dossier, plugin.manifeste);
    const ecart = comparerVersions(plugin.version, ancienne);
    if (ecart === 0) {
      rapport.erreur(
        fichier,
        `${modifies.length} fichier(s) modifié(s) depuis ${base} mais version toujours ${ancienne} : les utilisateurs ne verront pas la mise à jour.`,
      );
    } else if (ecart < 0) {
      rapport.erreur(fichier, `version ${plugin.version} inférieure à celle de ${base} (${ancienne}).`);
    }
  }
}

// --- Programme principal -----------------------------------------------------------

const options = lireArguments(process.argv.slice(2));
const racine = resolve(options.racine);
const marketplace = trouverMarketplace(racine);
if (!marketplace) quitter(`Aucun catalogue de marketplace dans ${racine} (attendu : .claude-plugin/marketplace.json).`);

const rapport = new Rapport(racine);
const catalogue = validerCatalogue(rapport, marketplace.chemin);
const plugins = [];
if (catalogue) {
  const dejaVus = new Set();
  catalogue.plugins.forEach((entree, index) => {
    if (!validerEntree(rapport, marketplace.chemin, entree, index, dejaVus)) return;
    const plugin = validerPlugin(rapport, racine, marketplace.chemin, entree);
    if (plugin) plugins.push(plugin);
  });
  if (catalogue.metadata?.pluginRoot !== undefined) {
    rapport.avertissement(marketplace.chemin, 'metadata.pluginRoot n’est pas pris en compte par ce validateur : les sources sont résolues depuis la racine.');
  }
}
if (options.base) validerIncrements(rapport, racine, plugins, options.base);

const erreurs = rapport.erreurs.length;
const avertissements = rapport.problemes.length - erreurs;

if (options.json) {
  process.stdout.write(`${JSON.stringify({ marketplace: catalogue?.name ?? null, catalogue: marketplace.relatif, plugins: plugins.map(({ dossier, ...reste }) => reste), problemes: rapport.problemes }, null, 2)}\n`);
} else {
  const libelles = {
    skills: ['skill', 'skills'],
    agents: ['agent', 'agents'],
    commandes: ['commande', 'commandes'],
    hooks: ['fichier de hooks', 'fichiers de hooks'],
    mcp: ['serveur MCP', 'serveurs MCP'],
  };
  console.log(`Marketplace « ${catalogue?.name ?? '?'} » (${marketplace.relatif}) : ${catalogue?.plugins?.length ?? 0} plugin(s).\n`);
  for (const { nom, version, composants } of plugins) {
    const contenu = Object.entries(composants)
      .filter(([, n]) => n > 0)
      .map(([type, n]) => `${n} ${libelles[type][n > 1 ? 1 : 0]}`)
      .join(', ');
    console.log(`  ${nom} ${version ?? '?'} · ${contenu || 'aucun composant'}`);
  }
  if (rapport.problemes.length) console.log('');
  for (const { niveau, fichier, message } of rapport.problemes) {
    console.log(`${niveau === 'erreur' ? 'ERREUR   ' : 'ATTENTION'} ${fichier} : ${message}`);
  }
  console.log(`\nBilan : ${erreurs} erreur(s), ${avertissements} avertissement(s).`);
}

// Annotations des fichiers dans une exécution GitHub Actions.
if (process.env.GITHUB_ACTIONS === 'true') {
  for (const { niveau, fichier, message } of rapport.problemes) {
    console.log(`::${niveau === 'erreur' ? 'error' : 'warning'} file=${fichier}::${message.replaceAll('%', '%25').replaceAll('\n', '%0A')}`);
  }
}

process.exit(erreurs > 0 ? 1 : 0);
