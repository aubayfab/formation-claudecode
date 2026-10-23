// Moteur des garde-fous : applique les règles à un appel d'outil et rédige la décision.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decrireAppel } from './analyse.mjs';
import { REGLES } from './regles.mjs';

// Au-delà de cette longueur, une commande n'est pas analysée mais soumise à
// confirmation : un texte démesuré pourrait faire durer l'analyse jusqu'au délai du
// hook, et un hook hors délai laisse passer l'appel.
export const LONGUEUR_MAX_COMMANDE = 8000;

const COMMANDE_TROP_LONGUE = {
  id: 'commande-trop-longue',
  decision: 'ask',
  raison: 'Commande de {detail} caractères, trop longue pour être analysée.',
  conseil: "Découpez-la, ou écrivez un script que l'utilisateur pourra relire.",
};

// Ajoutée au contexte du modèle quand un appel est refusé. Rédigée comme un constat,
// car Claude Code traite un texte qui ressemble à une consigne système comme une
// tentative d’injection et le signale à l’utilisateur au lieu de s’y conformer.
const CONSIGNE_REFUS =
  'Cet appel a été refusé par les garde-fous de l’équipe. Obtenir le même résultat par un autre ' +
  'chemin (autre outil, autre commande, encodage, script intermédiaire) contournerait la règle. ' +
  'L’utilisateur attend une explication de ce qui a été bloqué et l’alternative indiquée dans le refus.';

function premiereCorrespondance(motif, texte) {
  if (typeof motif === 'function') return motif(texte) ? texte : null;
  for (const expression of Array.isArray(motif) ? motif : [motif]) {
    const trouve = expression.exec(texte);
    if (trouve) return trouve[0];
  }
  return null;
}

function abreger(texte, longueur = 80) {
  return texte.length > longueur ? `${texte.slice(0, longueur - 1)}…` : texte;
}

/** Règles qui s'appliquent à l'appel décrit, avec le détail en cause pour chacune. */
export function evaluer(appel, { regles = REGLES, desactivees = [] } = {}) {
  const ignorees = new Set(desactivees);
  const analysables = appel.commandes.filter((commande) => commande.length <= LONGUEUR_MAX_COMMANDE);
  const constats = [];

  for (const regle of regles) {
    if (ignorees.has(regle.id)) continue;
    let detail = null;
    if (regle.cible === 'commande') {
      detail = analysables.find((commande) => premiereCorrespondance(regle.motif, commande) !== null) ?? null;
    } else if (regle.cible === 'chemin') {
      const vise = appel.chemins.find(
        ({ chemin, lecture, ecriture }) =>
          (regle.acces !== 'lecture' || lecture) &&
          (regle.acces !== 'ecriture' || ecriture) &&
          premiereCorrespondance(regle.motif, chemin) !== null,
      );
      detail = vise?.chemin ?? null;
    } else if (regle.cible === 'contenu') {
      const trouve = premiereCorrespondance(regle.motif, appel.texte);
      detail = trouve === null ? null : `${trouve.slice(0, 6)}…`;
    }
    if (detail !== null) constats.push({ regle, detail });
  }

  const tropLongue = appel.commandes.find((commande) => commande.length > LONGUEUR_MAX_COMMANDE);
  if (tropLongue && !ignorees.has(COMMANDE_TROP_LONGUE.id)) {
    constats.push({ regle: COMMANDE_TROP_LONGUE, detail: String(tropLongue.length) });
  }
  return constats;
}

/**
 * Réponse du hook : null si aucune règle ne s’applique (l’appel suit son cours normal),
 * sinon la décision la plus stricte, au format PreToolUse de Claude Code :
 * hookSpecificOutput avec permissionDecision et permissionDecisionReason. Pour un
 * refus, la raison est montrée à Claude ; pour une confirmation, à l’utilisateur.
 */
export function decider(constats, version = '?') {
  if (constats.length === 0) return null;
  const refus = constats.filter(({ regle }) => regle.decision === 'deny');
  const decision = refus.length > 0 ? 'deny' : 'ask';
  const motifs = (refus.length > 0 ? refus : constats).map(
    ({ regle, detail }) => `${regle.raison.replaceAll('{detail}', abreger(detail))} ${regle.conseil} [règle ${regle.id}]`,
  );
  const raison = `[garde-fous ${version}] ${decision === 'deny' ? 'Refusé' : 'Confirmation requise'} : ${motifs.join(' / ')}`;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: raison,
      ...(decision === 'deny' ? { additionalContext: CONSIGNE_REFUS } : {}),
    },
  };
}

/**
 * Configuration du projet, dans .claude/garde-fous.json : { "desactiver": ["id", ...] }.
 * Un fichier illisible ne désactive rien.
 */
export function lireConfiguration(racine) {
  const fichier = join(racine, '.claude', 'garde-fous.json');
  let brut;
  try {
    brut = readFileSync(fichier, 'utf8');
  } catch {
    return { desactivees: [] };
  }
  try {
    const { desactiver } = JSON.parse(brut);
    return { desactivees: Array.isArray(desactiver) ? desactiver.filter((id) => typeof id === 'string') : [] };
  } catch (erreur) {
    return { desactivees: [], avertissement: `${fichier} ignoré : ${erreur.message}` };
  }
}

/**
 * Traite un événement PreToolUse ; renvoie la réponse à écrire, ou null. Le dossier du
 * projet est celui que Claude Code exporte dans CLAUDE_PROJECT_DIR (le champ « cwd »
 * de l’événement suit les « cd » de l’agent).
 */
export function traiter(evenement, { version = '?', racine } = {}) {
  if (evenement.hook_event_name && evenement.hook_event_name !== 'PreToolUse') return null;
  const { desactivees, avertissement } = lireConfiguration(
    racine ?? process.env.CLAUDE_PROJECT_DIR ?? evenement.cwd ?? process.cwd(),
  );
  if (avertissement) process.stderr.write(`[garde-fous] ${avertissement}\n`);
  return decider(evaluer(decrireAppel(evenement), { desactivees }), version);
}
