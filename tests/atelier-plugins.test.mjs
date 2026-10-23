// Tests des scripts du plugin atelier-plugins : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = fileURLToPath(new URL('../plugins/atelier-plugins/skills/', import.meta.url));
const VALIDER = join(SCRIPTS, 'publier-plugin/scripts/valider.mjs');
const VERSION = join(SCRIPTS, 'publier-plugin/scripts/version.mjs');
const CREER = join(SCRIPTS, 'creer-plugin/scripts/creer.mjs');
const MARKETPLACE = fileURLToPath(new URL('..', import.meta.url));

function ecrire(racine, fichiers) {
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(racine, chemin)), { recursive: true });
    writeFileSync(join(racine, chemin), typeof contenu === 'string' ? contenu : `${JSON.stringify(contenu, null, 2)}\n`);
  }
}

/** Marketplace minimale valide avec un plugin « demo », modifiée par les fichiers donnés. */
function marketplace(fichiers = {}, entree = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'marketplace-'));
  ecrire(racine, {
    '.claude-plugin/marketplace.json': {
      name: 'essai',
      owner: { name: 'Équipe' },
      description: 'Marketplace d’essai.',
      plugins: [{ name: 'demo', source: './plugins/demo', description: 'Plugin de démonstration.', version: '1.0.0', ...entree }],
    },
    'plugins/demo/.claude-plugin/plugin.json': { name: 'demo', version: '1.0.0', description: 'Démo.' },
    'plugins/demo/README.md': '# demo\n',
    'plugins/demo/CHANGELOG.md': '# Changelog\n\n## [1.0.0] - 2026-01-01\n\n### Ajouté\n\n- Première version.\n',
    'plugins/demo/skills/bonjour/SKILL.md': '---\nname: bonjour\ndescription: Dit bonjour quand on le demande.\n---\n\nDis bonjour.\n',
    ...fichiers,
  });
  return racine;
}

function valider(racine, ...options) {
  const resultat = spawnSync(process.execPath, [VALIDER, racine, '--json', ...options], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });
  const sortie = resultat.stdout ? JSON.parse(resultat.stdout) : null;
  return { code: resultat.status, problemes: sortie?.problemes ?? [], stderr: resultat.stderr };
}

function attendreProbleme(racine, niveau, motif, ...options) {
  const { code, problemes } = valider(racine, ...options);
  const trouve = problemes.find((p) => p.niveau === niveau && motif.test(p.message));
  assert.ok(trouve, `${niveau} « ${motif} » attendu ; obtenu : ${JSON.stringify(problemes, null, 1)}`);
  if (niveau === 'erreur') assert.equal(code, 1);
}

test('la marketplace du dépôt est valide', () => {
  const { code, problemes } = valider(MARKETPLACE);
  assert.equal(code, 0, JSON.stringify(problemes, null, 1));
  assert.deepEqual(problemes, []);
});

test('une marketplace minimale valide ne signale rien', () => {
  const { code, problemes } = valider(marketplace());
  assert.equal(code, 0);
  assert.deepEqual(problemes, []);
});

test('versions différentes entre catalogue et manifeste', () => {
  attendreProbleme(marketplace({}, { version: '1.1.0' }), 'erreur', /version 1\.0\.0 dans le manifeste, 1\.1\.0 dans le catalogue/);
});

test('nom du manifeste différent de celui du catalogue', () => {
  attendreProbleme(marketplace({ 'plugins/demo/.claude-plugin/plugin.json': { name: 'autre', version: '1.0.0' } }), 'erreur', /s’appelle « autre »/);
});

test('manifeste au mauvais emplacement', () => {
  const racine = marketplace({ 'plugins/demo/plugin.json': { name: 'demo', version: '1.0.0' } });
  rmSync(join(racine, 'plugins/demo/.claude-plugin'), { recursive: true });
  attendreProbleme(racine, 'erreur', /\.claude-plugin\/plugin\.json est attendu/);
});

test('champ inconnu du manifeste et URL de page d’accueil invalide', () => {
  const racine = marketplace({ 'plugins/demo/.claude-plugin/plugin.json': { name: 'demo', version: '1.0.0', schema: 'x', homepage: 'pas une url' } });
  attendreProbleme(racine, 'avertissement', /champ « schema » inconnu/);
  attendreProbleme(racine, 'erreur', /« homepage » n’est pas une URL/);
});

test('source locale sans « ./ » ou avec « .. »', () => {
  attendreProbleme(marketplace({}, { source: 'plugins/demo' }), 'erreur', /commence par « \.\/ »/);
  attendreProbleme(marketplace({}, { source: './plugins/../plugins/demo' }), 'erreur', /contient « \.\. »/);
});

test('skill sans description', () => {
  attendreProbleme(marketplace({ 'plugins/demo/skills/bonjour/SKILL.md': '---\nname: bonjour\n---\n' }), 'erreur', /« description » est obligatoire/);
});

test('skill dont le name diffère du dossier', () => {
  const racine = marketplace({ 'plugins/demo/skills/bonjour/SKILL.md': '---\nname: salut\ndescription: x\n---\n' });
  attendreProbleme(racine, 'avertissement', /remplace le nom du dossier/);
});

test('lien cassé ou hors du plugin dans un SKILL.md', () => {
  const racine = marketplace({
    'plugins/demo/skills/bonjour/SKILL.md':
      '---\nname: bonjour\ndescription: x\n---\n\nVoir [le script](scripts/absent.mjs), [la doc](../../../../README.md) et [le site](https://exemple.org).\n\n```md\n[exemple](ignore.md)\n```\n',
  });
  attendreProbleme(racine, 'erreur', /mène à un fichier absent/);
  attendreProbleme(racine, 'erreur', /sort du plugin/);
  assert.ok(!valider(racine).problemes.some((p) => /ignore\.md|exemple\.org/.test(p.message)));
});

test('agent de plugin : champs ignorés ou inconnus, description absente', () => {
  const racine = marketplace({
    'plugins/demo/agents/relecteur.md': '---\nname: relecteur\ndescription: Relit.\npermissionMode: plan\nargument-hint: x\n---\nRelis.\n',
    'plugins/demo/agents/muet.md': '---\nname: muet\n---\nRien.\n',
  });
  attendreProbleme(racine, 'avertissement', /« permissionMode » ignoré par Claude Code pour un agent livré par un plugin/);
  attendreProbleme(racine, 'avertissement', /« argument-hint » inconnu/);
  attendreProbleme(racine, 'erreur', /agent sans « description »/);
});

test('hook dont le fichier n’a pas l’enveloppe « hooks »', () => {
  const racine = marketplace({ 'plugins/demo/hooks/hooks.json': { PreToolUse: [] } });
  attendreProbleme(racine, 'erreur', /« hooks » doit être un objet/);
});

test('hook dont le script est absent, désigné par un chemin relatif, ou sans guillemets', () => {
  const racine = marketplace({
    'plugins/demo/scripts/present.mjs': '',
    'plugins/demo/hooks/hooks.json': {
      hooks: {
        PreToolUse: [
          {
            matcher: '*',
            hooks: [
              { type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/absent.mjs'] },
              { type: 'command', command: 'node scripts/present.mjs' },
              { type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/present.mjs' },
            ],
          },
        ],
        SurEvenementInconnu: [{ hooks: [{ type: 'command', command: 'echo' }] }],
      },
    },
  });
  attendreProbleme(racine, 'erreur', /« \/scripts\/absent\.mjs » n’existe pas/);
  attendreProbleme(racine, 'erreur', /relatif au projet de l’utilisateur/);
  attendreProbleme(racine, 'avertissement', /entre guillemets/);
  attendreProbleme(racine, 'avertissement', /SurEvenementInconnu/);
});

test('script JavaScript livré avec une erreur de syntaxe', () => {
  const racine = marketplace({ 'plugins/demo/skills/bonjour/scripts/outil.mjs': 'export const motif = /(non fermée/;\n' });
  attendreProbleme(racine, 'erreur', /script JavaScript invalide/);
});

test('emplacements que Claude Code ne charge pas', () => {
  const racine = marketplace({
    'plugins/demo/CLAUDE.md': 'Consignes.\n',
    'plugins/demo/rules/tests.md': 'Règle.\n',
    'plugins/demo/com.github.copilot/agents/a.agent.md': 'x\n',
  });
  const { problemes } = valider(racine);
  for (const motif of [/CLAUDE\.md n’est pas chargé/, /un plugin ne livre pas de règles/, /propre à GitHub Copilot/]) {
    assert.ok(problemes.some((p) => p.niveau === 'avertissement' && motif.test(p.message)), `${motif} attendu`);
  }
});

test('.mcp.json : serveur incomplet ou secret en clair', () => {
  const racine = marketplace({
    'plugins/demo/.mcp.json': {
      mcpServers: {
        incomplet: { args: ['x'] },
        distant: { type: 'http', url: 'https://exemple.org/mcp', headers: { Authorization: 'Bearer x' } },
        sain: { type: 'http', url: 'https://exemple.org/mcp', headers: { Authorization: 'Bearer ${JETON}' } },
      },
    },
  });
  const { problemes } = valider(racine);
  for (const motif of [/« command » \(serveur local\) ou « url »/, /aucun secret dans un plugin/]) {
    assert.ok(problemes.some((p) => p.niveau === 'erreur' && motif.test(p.message)), `erreur ${motif} attendue`);
  }
  assert.equal(problemes.filter((p) => /sain/.test(p.message)).length, 0);
});

test('catalogue incomplet', () => {
  const racine = mkdtempSync(join(tmpdir(), 'marketplace-'));
  ecrire(racine, { '.claude-plugin/marketplace.json': { name: 'Mauvais Nom', plugins: [{ name: 'x', version: '1.0' }, { name: 'x', source: './x' }] } });
  const { code, problemes } = valider(racine);
  assert.equal(code, 1);
  for (const motif of [/« name » est obligatoire/, /« owner\.name »/, /« source » est obligatoire/, /non sémantique/, /déclaré deux fois/, /n’existe pas/]) {
    assert.ok(problemes.some((p) => motif.test(p.message)), `${motif} attendu`);
  }
});

test('absence de catalogue : code 2', () => {
  assert.equal(valider(mkdtempSync(join(tmpdir(), 'vide-'))).code, 2);
});

function depotGit(racine) {
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '-b', 'marketplace');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  return git;
}

test('--base : un plugin modifié sans nouvelle version est refusé, puis accepté après version.mjs', () => {
  const racine = marketplace();
  depotGit(racine);
  writeFileSync(join(racine, 'plugins/demo/skills/bonjour/SKILL.md'), '---\nname: bonjour\ndescription: Dit bonjour poliment.\n---\n\nDis bonjour.\n');
  attendreProbleme(racine, 'erreur', /version toujours 1\.0\.0/, '--base', 'HEAD');

  const resultat = spawnSync(process.execPath, [VERSION, 'demo', 'minor', '--note', 'Bonjour plus poli.', '--racine', racine], { encoding: 'utf8' });
  assert.equal(resultat.status, 0, resultat.stderr);
  assert.match(resultat.stdout, /demo : 1\.0\.0 → 1\.1\.0/);
  const { code, problemes } = valider(racine, '--base', 'HEAD');
  assert.equal(code, 0, JSON.stringify(problemes));
});

test('--base : référence inconnue, code 2', () => {
  const racine = marketplace();
  depotGit(racine);
  assert.equal(valider(racine, '--base', 'origin/nexiste-pas').code, 2);
});

test('version.mjs ne change que les lignes de version et ouvre le changelog', () => {
  const racine = marketplace();
  const avantCatalogue = readFileSync(join(racine, '.claude-plugin/marketplace.json'), 'utf8');
  const resultat = spawnSync(process.execPath, [VERSION, 'demo', 'patch', '--note', 'Faute corrigée.', '--racine', racine], { encoding: 'utf8' });
  assert.equal(resultat.status, 0, resultat.stderr);
  const apresCatalogue = readFileSync(join(racine, '.claude-plugin/marketplace.json'), 'utf8');
  const differences = apresCatalogue.split('\n').filter((ligne, i) => ligne !== avantCatalogue.split('\n')[i]);
  assert.deepEqual(differences, ['      "version": "1.0.1"']);
  assert.equal(JSON.parse(readFileSync(join(racine, 'plugins/demo/.claude-plugin/plugin.json'), 'utf8')).version, '1.0.1');
  const changelog = readFileSync(join(racine, 'plugins/demo/CHANGELOG.md'), 'utf8');
  assert.match(changelog, /## \[1\.0\.1\] - \d{4}-\d{2}-\d{2}\n\n### Corrigé\n\n- Faute corrigée\.\n\n## \[1\.0\.0\]/);
});

test('version.mjs : un incrément minor ajoute l’entrée sous « Ajouté »', () => {
  const racine = marketplace();
  const resultat = spawnSync(process.execPath, [VERSION, 'demo', 'minor', '--note', 'Nouvelle règle.', '--racine', racine], { encoding: 'utf8' });
  assert.equal(resultat.status, 0, resultat.stderr);
  const changelog = readFileSync(join(racine, 'plugins/demo/CHANGELOG.md'), 'utf8');
  assert.match(changelog, /## \[1\.1\.0\] - \d{4}-\d{2}-\d{2}\n\n### Ajouté\n\n- Nouvelle règle\.\n\n## \[1\.0\.0\]/);
});

test('version.mjs refuse une version plus basse, une note absente, un plugin inconnu', () => {
  const racine = marketplace();
  const lancer = (...args) => spawnSync(process.execPath, [VERSION, ...args, '--racine', racine], { encoding: 'utf8' }).status;
  assert.equal(lancer('demo', '0.9.0', '--note', 'x'), 1);
  assert.equal(lancer('demo', 'minor'), 2);
  assert.equal(lancer('inconnu', 'minor', '--note', 'x'), 1);
});

test('creer.mjs empaquette un dossier .claude et produit un plugin valide', () => {
  const racine = marketplace();
  const projet = mkdtempSync(join(tmpdir(), 'projet-'));
  ecrire(projet, {
    '.claude/skills/contraste/SKILL.md': '---\nname: contraste\ndescription: Vérifie le contraste des couleurs.\n---\n\nVoir [le script](scripts/c.mjs).\n',
    '.claude/skills/contraste/scripts/c.mjs': 'console.log(1);\n',
    '.claude/agents/relecteur.md': '---\nname: relecteur\ndescription: Relit.\ntools: Read, Grep\n---\nRelis.\n',
    '.claude/commands/check.md': '---\ndescription: Vérifie.\n---\nVérifie.\n',
    '.claude/rules/ts.md': '---\npaths: "**/*.ts"\n---\nTypes stricts.\n',
  });
  const avant = readFileSync(join(racine, '.claude-plugin/marketplace.json'), 'utf8');
  const resultat = spawnSync(
    process.execPath,
    [CREER, 'equipe-front', '--description', 'Personnalisations de l’équipe front.', '--depuis', join(projet, '.claude'), '--racine', racine],
    { encoding: 'utf8' },
  );
  assert.equal(resultat.status, 0, resultat.stderr);
  const apres = readFileSync(join(racine, '.claude-plugin/marketplace.json'), 'utf8');
  assert.ok(apres.startsWith(avant.slice(0, avant.lastIndexOf('}', avant.lastIndexOf(']')) + 1)), 'les entrées existantes ne doivent pas être reformatées');
  const catalogue = JSON.parse(apres);
  assert.deepEqual(catalogue.plugins.map((p) => p.name), ['demo', 'equipe-front']);
  for (const fichier of ['skills/contraste/SKILL.md', 'skills/contraste/scripts/c.mjs', 'agents/relecteur.md', 'commands/check.md', '.claude-plugin/plugin.json']) {
    assert.ok(readFileSync(join(racine, 'plugins/equipe-front', fichier)), fichier);
  }
  assert.equal(JSON.parse(readFileSync(join(racine, 'plugins/equipe-front/.claude-plugin/plugin.json'), 'utf8')).version, '0.1.0');
  assert.match(resultat.stdout, /ATTENTION \.claude\/rules\/ n’est pas repris/);
  const { code, problemes } = valider(racine);
  assert.equal(code, 0, JSON.stringify(problemes, null, 1));
});

test('creer.mjs refuse un nom déjà pris ou invalide', () => {
  const racine = marketplace();
  const lancer = (...args) => spawnSync(process.execPath, [CREER, ...args, '--racine', racine], { encoding: 'utf8' }).status;
  assert.equal(lancer('demo', '--description', 'x'), 1);
  assert.equal(lancer('Mon_Plugin', '--description', 'x'), 2);
  assert.equal(lancer('nouveau'), 2);
});
