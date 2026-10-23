---
name: creer-jeu
description: Crée un mini-jeu jouable dans le navigateur (Canvas 2D, JavaScript ou TypeScript) à partir d'une demande comme « fais-moi un casse-briques », un pong, un démineur, un snake ou un jeu de réflexes. Utiliser pour tout nouveau jeu, avec boucle de jeu, score, tableau des meilleurs scores et effets visuels.
---

# Créer un mini-jeu navigateur

## Quand l'utiliser
L'utilisateur demande un nouveau jeu jouable dans le navigateur. Si la demande est vague, choisis des valeurs raisonnables (taille de la zone, vitesse, nombre de vies) et indique-les dans ton résumé final plutôt que de poser des questions.

## 1. Repérer le projet
- Si le projet utilise TypeScript, écris le jeu en TypeScript ; sinon en JavaScript.
- Crée un dossier dédié au jeu, par exemple `src/games/<nom-du-jeu>/`.
- Si le projet a déjà un menu ou une page d'accueil, ajoute-y un lien vers le jeu. Sinon, crée une page autonome.

## 2. Structure du code
Regroupe le jeu dans une classe `Game` qui possède le canvas, l'état et la boucle :

```ts
export class Game {
  private ctx: CanvasRenderingContext2D;
  private last = 0;
  score = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  start() {
    requestAnimationFrame(this.loop);
  }

  private loop = (t: number) => {
    this.update();
    this.draw();
    requestAnimationFrame(this.loop);
  };

  private update() {
    // déplacements, collisions, score
  }

  private draw() {
    // rendu sur this.ctx
  }
}
```

Pour faciliter le débogage dans la console, expose l'instance : `(window as any).game = game;`.

## 3. Contrôles
- Clavier : flèches ou ZQSD pour les déplacements, Espace pour l'action principale, P pour la pause.
- Ajoute la souris ou le tactile quand le jeu s'y prête (raquette à la souris, clic sur une case).
- Affiche un bouton « Jouer » au démarrage et un bouton « Rejouer » en fin de partie.

## 4. Règles et difficulté
- Implémente les règles classiques du jeu demandé.
- Fais monter la difficulté au fil de la partie (vitesse, densité d'ennemis, temps réduit).
- Utilise `Math.random()` pour les éléments aléatoires (position des mines, angle de départ, apparition des bonus).

## 5. Rendu et effets
Un jeu doit être vivant. Pour un style arcade :
- palette néon sur fond sombre : `#0ff`, `#f0f`, `#ff0` sur `#0a0a1a` ;
- lueur sur les éléments avec `ctx.shadowBlur = 15` et `ctx.shadowColor` ;
- particules à chaque destruction, léger tremblement d'écran à chaque impact ;
- texte « GAME OVER » qui clignote en fin de partie ;
- police à chasse fixe ou pixel (`"Press Start 2P", monospace`).

Ajoute des bruitages courts avec la Web Audio API (un `OscillatorNode` de 50 à 100 ms) pour les rebonds, les points marqués et la fin de partie.

## 6. Score et meilleurs scores
- Affiche le score en permanence en haut de l'écran.
- En fin de partie, demande le nom du joueur dans un champ texte, puis enregistre `{ nom, score, date }` dans `localStorage` sous la clé `<nom-du-jeu>-highscores`.
- Affiche les dix meilleurs :

```ts
liste.innerHTML = scores
  .map((s, i) => `<li>${i + 1}. ${s.nom} : ${s.score}</li>`)
  .join("");
```

## 7. Vérifier
- Lance le jeu et joue une partie complète : démarrage, partie, fin, enregistrement du score, rejouer.
- Corrige les erreurs de la console.
- Si le projet a déjà des tests, tu peux ajouter quelques tests sur le calcul du score.

## 8. Résumé final
Indique les fichiers créés, les commandes de jeu et les valeurs choisies (vitesse, vies, taille).
