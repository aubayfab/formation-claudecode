#!/usr/bin/env node
/**
 * Totaux pondérés d'une version de la skill creer-jeu.
 *
 * Usage : node calculer-totaux.mjs <dossier-de-version> [--comparer <dossier-d-une-autre-version>]
 *
 * Lit, pour chaque évaluation, resultats/<n>-<id>/script.json (sortie du script-grader) et
 * resultats/<n>-<id>/modele.md (réponse du model-grader, terminée par un objet JSON).
 * Chaque critère est noté sur 10. Total sur 100 = 10 × somme(coefficient × note) / somme(coefficients).
 * Une évaluation à qui il manque une note est signalée et n'a pas de total.
 * Écrit totaux.json et totaux.md dans le dossier de la version, puis affiche totaux.md.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CRITERES = [
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "C10",
  "C11",
  "C12",
];
const DU_SCRIPT = ["C9", "C11"];
const COEFFICIENTS = JSON.parse(
  readFileSync(new URL("../coefficients.json", import.meta.url), "utf8"),
);
const SOMME_COEFFICIENTS = CRITERES.reduce(
  (somme, c) => somme + COEFFICIENTS[c],
  0,
);

const [dossier, option, dossierReference] = process.argv.slice(2);
if (!dossier || (option && (option !== "--comparer" || !dossierReference))) {
  console.error(
    "Usage : node calculer-totaux.mjs <dossier-de-version> [--comparer <autre-dossier>]",
  );
  process.exit(2);
}

const nombre = (valeur) =>
  valeur === null ? "—" : valeur.toFixed(1).replace(".", ",");
const moyenne = (valeurs) =>
  valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;

function lireJson(fichier) {
  try {
    return JSON.parse(readFileSync(fichier, "utf8"));
  } catch {
    return {};
  }
}

/** Dernier objet JSON d'une réponse : dernier bloc ```json, sinon dernier objet du texte. */
function dernierObjetJson(texte) {
  const blocs = [...texte.matchAll(/```json\s*([\s\S]*?)```/g)]
    .map((m) => m[1])
    .reverse();
  for (const bloc of blocs) {
    try {
      return JSON.parse(bloc);
    } catch {}
  }
  const fin = texte.lastIndexOf("}");
  for (
    let debut = texte.lastIndexOf("{", fin);
    debut >= 0;
    debut = texte.lastIndexOf("{", debut - 1)
  ) {
    try {
      return JSON.parse(texte.slice(debut, fin + 1));
    } catch {}
  }
  return {};
}

function evaluations(dossierVersion) {
  const racine = path.join(dossierVersion, "resultats");
  if (!existsSync(racine)) {
    console.error(`Aucun dossier resultats/ dans ${dossierVersion}`);
    process.exit(2);
  }
  return readdirSync(racine)
    .sort()
    .map((nom) => {
      const script =
        lireJson(path.join(racine, nom, "script.json")).notes ?? {};
      const fichierModele = path.join(racine, nom, "modele.md");
      const modele = existsSync(fichierModele)
        ? dernierObjetJson(readFileSync(fichierModele, "utf8"))
        : {};
      const notes = {};
      for (const critere of CRITERES) {
        const note = (DU_SCRIPT.includes(critere) ? script : modele)[critere];
        if (Number.isInteger(note) && note >= 0 && note <= 10)
          notes[critere] = note;
      }
      const manquants = CRITERES.filter((critere) => !(critere in notes));
      const total = manquants.length
        ? null
        : (10 *
            CRITERES.reduce(
              (somme, c) => somme + COEFFICIENTS[c] * notes[c],
              0,
            )) /
          SOMME_COEFFICIENTS;
      return { nom, notes, manquants, total };
    });
}

/** Moyenne de chaque critère sur les évaluations qui l'ont, et moyenne des totaux complets. */
function moyennes(liste) {
  const parCritere = Object.fromEntries(
    CRITERES.map((c) => [
      c,
      moyenne(liste.filter((e) => c in e.notes).map((e) => e.notes[c])),
    ]),
  );
  return {
    parCritere,
    total: moyenne(liste.filter((e) => e.total !== null).map((e) => e.total)),
  };
}

const version = path.basename(path.resolve(dossier));
const liste = evaluations(dossier);
const resume = moyennes(liste);

const lignes = [
  `# Totaux : ${version}`,
  "",
  `| Évaluation | ${CRITERES.join(" | ")} | Total /100 |`,
  `| --- | ${CRITERES.map(() => "---:").join(" | ")} | ---: |`,
  `| Coefficient | ${CRITERES.map((c) => COEFFICIENTS[c]).join(" | ")} | |`,
  ...liste.map(
    (e) =>
      `| ${e.nom} | ${CRITERES.map((c) => e.notes[c] ?? "—").join(" | ")} | ${
        e.total === null
          ? `incomplet (manque ${e.manquants.join(", ")})`
          : nombre(e.total)
      } |`,
  ),
  `| **Moyenne** | ${CRITERES.map((c) => nombre(resume.parCritere[c])).join(" | ")} | **${nombre(resume.total)}** |`,
];

let comparaison = null;
if (dossierReference) {
  const reference = path.basename(path.resolve(dossierReference));
  const listeReference = evaluations(dossierReference);
  const resumeReference = moyennes(listeReference);
  const ecart = (avant, apres) =>
    avant === null || apres === null
      ? "—"
      : `${apres >= avant ? "+" : ""}${nombre(apres - avant)}`;
  comparaison = {
    reference,
    evaluations: listeReference,
    moyennes: resumeReference,
  };
  lignes.push(
    "",
    `## Comparaison avec ${reference}`,
    "",
    `| Critère | Coef. | ${reference} | ${version} | Écart |`,
    "| --- | ---: | ---: | ---: | ---: |",
    ...CRITERES.map((c) => {
      const [avant, apres] = [
        resumeReference.parCritere[c],
        resume.parCritere[c],
      ];
      return `| ${c} | ${COEFFICIENTS[c]} | ${nombre(avant)} | ${nombre(apres)} | ${ecart(avant, apres)} |`;
    }),
  );

  // Totaux : seulement les évaluations complètes dans les deux versions, pour comparer à périmètre égal.
  const totalReference = new Map(listeReference.map((e) => [e.nom, e.total]));
  const communes = liste.filter(
    (e) => e.total !== null && totalReference.get(e.nom) != null,
  );
  lignes.push(
    "",
    `| Évaluation | ${reference} | ${version} | Écart |`,
    "| --- | ---: | ---: | ---: |",
    ...communes.map((e) => {
      const avant = totalReference.get(e.nom);
      return `| ${e.nom} | ${nombre(avant)} | ${nombre(e.total)} | ${ecart(avant, e.total)} |`;
    }),
  );
  if (communes.length) {
    const avant = moyenne(communes.map((e) => totalReference.get(e.nom)));
    const apres = moyenne(communes.map((e) => e.total));
    lignes.push(
      `| **Moyenne** | ${nombre(avant)} | ${nombre(apres)} | ${ecart(avant, apres)} |`,
    );
  }
  lignes.push(
    "",
    "Moyennes par critère : sur les évaluations qui ont cette note. Totaux : sur les évaluations complètes dans les deux versions.",
  );
}

const markdown = `${lignes.join("\n")}\n`;
writeFileSync(path.join(dossier, "totaux.md"), markdown);
writeFileSync(
  path.join(dossier, "totaux.json"),
  `${JSON.stringify({ version, coefficients: COEFFICIENTS, evaluations: liste, moyennes: resume, comparaison }, null, 2)}\n`,
);
console.log(markdown);
