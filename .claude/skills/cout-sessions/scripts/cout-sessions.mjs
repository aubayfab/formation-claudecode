#!/usr/bin/env node
// Coût et tokens des dernières sessions Claude Code d'un projet, lus dans leurs transcriptions locales.
//
// Claude Code enregistre chaque session dans <config>/projects/<dossier du projet>/<session>.jsonl, et
// les sous-agents dans <session>/subagents/*.jsonl. Chaque réponse du modèle porte son « usage » (tokens).
// À la fin d'une session, Claude Code ajoute une entrée « cost-state » : son coût total, sous-agents
// compris, au tarif public de l'API. Tant qu'une session reste ouverte, cette entrée n'existe pas : le
// script affiche alors ses tokens, sans coût.
//
// Usage : node cout-sessions.mjs <id de la session courante> [nombre de sessions, 8 par défaut]
// <config> vaut $CLAUDE_CONFIG_DIR, ou ~/.claude.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [idCourant = '', nombreTexte = '8'] = process.argv.slice(2);
const nombre = Math.max(1, Number.parseInt(nombreTexte, 10) || 8);
const racine = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');

/** Dossier de transcriptions du projet : celui qui contient la session courante, sinon celui du dossier courant. */
function dossierDuProjet() {
  if (!fs.existsSync(racine)) return null;
  const dossiers = fs.readdirSync(racine, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  if (idCourant) for (const d of dossiers) if (fs.existsSync(path.join(racine, d, `${idCourant}.jsonl`))) return path.join(racine, d);
  const attendu = process.cwd().replace(/[^A-Za-z0-9]/g, '-').toLowerCase();
  const trouve = dossiers.find((d) => d.toLowerCase() === attendu);
  return trouve ? path.join(racine, trouve) : null;
}

function lire(fichier) {
  const objets = [];
  for (const ligne of fs.readFileSync(fichier, 'utf8').split('\n')) {
    if (!ligne) continue;
    try { objets.push(JSON.parse(ligne)); } catch { /* ligne en cours d'écriture */ }
  }
  return objets;
}

/** Somme des usages des réponses du modèle, une fois par message (une réponse peut occuper plusieurs lignes). */
function additionner(objets, total) {
  const vus = new Set();
  for (const o of objets) {
    const u = o.type === 'assistant' ? o.message?.usage : null;
    if (!u) continue;
    const cle = o.message.id || o.uuid;
    if (vus.has(cle)) continue;
    vus.add(cle);
    total.entree += u.input_tokens || 0;
    total.cacheLu += u.cache_read_input_tokens || 0;
    total.cacheEcrit += u.cache_creation_input_tokens || 0;
    total.sortie += u.output_tokens || 0;
    if (o.message.model && !o.message.model.startsWith('<')) total.modeles.add(o.message.model);
  }
  return total;
}

function premierPrompt(objets) {
  for (const o of objets) {
    if (o.type !== 'user' || o.isMeta || o.isSidechain) continue;
    const c = o.message?.content;
    const texte = typeof c === 'string' ? c : Array.isArray(c) ? (c.find((b) => b.type === 'text')?.text ?? '') : '';
    const commande = texte.match(/<command-name>([^<]*)<\/command-name>/);
    if (commande) {
      const args = texte.match(/<command-args>([^<]*)<\/command-args>/)?.[1] ?? '';
      return `${commande[1].trim()} ${args}`.replace(/\s+/g, ' ').trim();
    }
    const propre = texte.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (propre) return propre;
  }
  return '';
}

function session(fichier) {
  const objets = lire(fichier);
  const total = additionner(objets, { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0, modeles: new Set() });
  const dossierSous = path.join(fichier.replace(/\.jsonl$/, ''), 'subagents');
  let sousAgents = 0;
  if (fs.existsSync(dossierSous)) {
    for (const f of fs.readdirSync(dossierSous).filter((x) => x.endsWith('.jsonl'))) {
      additionner(lire(path.join(dossierSous, f)), total);
      sousAgents++;
    }
  }
  const couts = objets.filter((o) => o.type === 'cost-state');
  const reponses = objets.filter((o) => o.type === 'assistant' && o.message?.usage && !o.isSidechain);
  const derniere = reponses.at(-1)?.message.usage;
  const horodatages = objets.map((o) => o.timestamp).filter(Boolean).sort();
  return {
    id: path.basename(fichier, '.jsonl'),
    debut: horodatages[0] ?? fs.statSync(fichier).birthtime.toISOString(),
    prompt: premierPrompt(objets),
    cout: couts.length ? couts.at(-1).totalCostUSD : null,
    contexte: derniere ? (derniere.input_tokens || 0) + (derniere.cache_read_input_tokens || 0) + (derniere.cache_creation_input_tokens || 0) : 0,
    sousAgents,
    ...total,
  };
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const k = (n) => (n >= 1e6 ? `${nf.format(n / 1e6)} M` : n >= 1e3 ? `${nf.format(n / 1e3)} k` : String(n));
const dollars = (v) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 3 : 2 }).format(v)} $`;
const date = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const cellule = (t) => t.replace(/\|/g, '/');

const dossier = dossierDuProjet();
if (!dossier) {
  console.log(`Aucune transcription trouvée pour ce projet sous ${racine}.`);
  process.exit(0);
}
const sessions = fs.readdirSync(dossier).filter((f) => f.endsWith('.jsonl'))
  .map((f) => session(path.join(dossier, f)))
  .filter((s) => s.prompt || s.sortie)
  .sort((a, b) => a.debut.localeCompare(b.debut))
  .slice(-nombre);

console.log(`Sessions de ${path.basename(dossier)} (les ${sessions.length} plus récentes, la plus ancienne en tête)\n`);
console.log('| # | Début | Premier prompt | Modèles | Coût | Tokens lus (dont cache) | Tokens écrits | Contexte à la fin |');
console.log('| - | - | - | - | - | - | - | - |');
sessions.forEach((s, i) => {
  const lus = s.entree + s.cacheLu + s.cacheEcrit;
  const cout = s.cout !== null ? dollars(s.cout) : s.id === idCourant ? 'session en cours' : 'non enregistré';
  const prompt = s.prompt.length > 60 ? `${s.prompt.slice(0, 57)}…` : s.prompt;
  const modeles = [...s.modeles].map((m) => m.replace(/^claude-/, '')).join(', ') + (s.sousAgents ? ` (${s.sousAgents} sous-agent${s.sousAgents > 1 ? 's' : ''})` : '');
  console.log(`| ${i + 1} | ${date(s.debut)} | ${cellule(prompt)} | ${modeles} | ${cout} | ${k(lus)} (${k(s.cacheLu + s.cacheEcrit)}) | ${k(s.sortie)} | ${k(s.contexte)} |`);
});
console.log('\nCoût : enregistré par Claude Code à la fin de chaque session, sous-agents compris, au tarif public de l’API.');
console.log('Contexte à la fin : tokens de la dernière requête de la session principale, sans ceux des sous-agents.');
