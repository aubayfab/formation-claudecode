#!/usr/bin/env node
// Hook PreToolUse des garde-fous.
//
// Lit l’événement JSON de Claude Code sur l’entrée standard. Si une règle s’applique,
// répond par une décision « deny » ou « ask » sur la sortie standard (objet
// hookSpecificOutput, code de sortie 0) ; sinon ne répond rien, et l’appel suit le
// circuit d’approbation habituel de Claude Code.
//
// Le hook ne sort jamais en erreur. Un échec du hook (code de sortie autre que 0 ou 2,
// délai dépassé, sortie illisible) n’empêche pas l’appel d’outil : il est signalé comme
// erreur non bloquante. Une erreur interne, y compris une erreur de syntaxe dans
// regles.mjs (d’où l’import dynamique), est donc écrite sur la sortie d’erreur et
// l’appel suit son cours.

import { readFileSync } from 'node:fs';

function versionDuPlugin() {
  try {
    const manifeste = new URL('../.claude-plugin/plugin.json', import.meta.url);
    return JSON.parse(readFileSync(manifeste, 'utf8')).version ?? '?';
  } catch {
    return '?';
  }
}

try {
  const { traiter } = await import('./moteur.mjs');
  process.stdin.setEncoding('utf8');
  let brut = '';
  for await (const morceau of process.stdin) brut += morceau;
  const reponse = traiter(JSON.parse(brut || '{}'), { version: versionDuPlugin() });
  if (reponse) process.stdout.write(JSON.stringify(reponse));
} catch (erreur) {
  process.stderr.write(`[garde-fous] erreur interne, appel laissé à la décision habituelle : ${erreur.message}\n`);
}
