# garde-fous

Un hook `PreToolUse` qui examine chaque appel d’outil de Claude Code **avant** son exécution, et le refuse ou le soumet à votre confirmation quand il est dangereux : commande destructrice, lecture ou envoi de secrets, modification de la configuration de Claude Code lui-même.

Chaque décision cite la règle en cause et propose à Claude une alternative. Quand aucune règle ne s’applique, le hook ne répond rien : l’appel suit le circuit d’approbation habituel.

## Installation

```sh
claude plugin install garde-fous@formation-claudecode
```

## Règles

| Règle | Décision | Ce qui est intercepté |
| --- | --- | --- |
| `suppression-massive` | refus | `rm -r`, `Remove-Item -Recurse`, `rd /s`, `rimraf` visant `/`, `~`, `C:\`, un dossier système ou le répertoire courant entier |
| `formatage-disque` | refus | `mkfs`, `dd of=/dev/…`, `format C:`, `diskpart`, `Format-Volume` |
| `chmod-777` | refus | `chmod 777`, `a+rwx` |
| `git-push-force` | refus | `git push --force`, `-f`, `+branche` (mais pas `--force-with-lease`) |
| `git-reset-hard` | confirmation | `git reset --hard` |
| `git-clean` | confirmation | `git clean -f…` |
| `git-abandon-modifications` | confirmation | `git checkout -- .`, `git restore .` |
| `contournement-verifications` | confirmation | `git … --no-verify` |
| `telecharger-executer` | refus | `curl … \| bash`, `iwr … \| iex`, `bash <(curl …)` |
| `exfiltration` | refus | `curl -d @fichier`, `curl -F f=@…`, `-T`, `wget --post-file`, `Invoke-RestMethod -InFile`, `… \| nc hôte port` |
| `transfert-distant` | confirmation | `scp`, `rsync`, `sftp` vers `utilisateur@hôte:` |
| `variables-environnement` | confirmation | `printenv`, `env`, `Get-ChildItem env:` |
| `elevation-privileges` | confirmation | `sudo`, `doas`, `runas`, `-Verb RunAs` |
| `publication-paquet` | confirmation | `npm publish`, `docker push`, `twine upload`, `cargo publish`… |
| `secrets-lecture` | refus | lecture de `.env*` (sauf `.env.example`, `.sample`, `.template`, `.dist`), clés SSH privées, `*.pem`, `*.key`, `.npmrc`, `.aws/credentials`, `.kube/config`… par l’outil `Read`, une recherche `Grep` ou une commande (`cat`, `Get-Content`, `python -c …`, `cp`, `< .env`) |
| `secrets-ecriture` | confirmation | modification de ces mêmes fichiers (`Write`, `Edit`, redirection, `rm`…) |
| `secret-en-clair` | refus | appel d’outil contenant un jeton reconnaissable : GitHub (`ghp_`, `github_pat_`), AWS (`AKIA…`), clé privée PEM, Slack, Google, Stripe, OpenAI/Anthropic |
| `config-garde-fous` | refus | écriture de `.claude/garde-fous.json` par Claude |
| `config-agent` | confirmation | écriture de `.claude/settings.json`, `.claude/settings.local.json`, `.mcp.json`, `.claude.json` |
| `commande-trop-longue` | confirmation | commande de plus de 8 000 caractères, non analysée |

Quand plusieurs règles s’appliquent, le refus l’emporte sur la confirmation.

## Fonctionnement

Claude Code lance `node scripts/garde-fous.mjs` avant chaque appel d’outil (le champ `matcher` du hook vaut `*`) et lui transmet l’appel en JSON sur l’entrée standard : `tool_name` (`Bash`, `PowerShell`, `Read`, `Write`, `Edit`, `Grep`…) et `tool_input` (`command`, `file_path`, `path`…). Le script parcourt toute l’entrée de l’outil et classe l’outil d’après son nom plutôt que de dépendre d’un champ précis. Il couvre ainsi aussi les outils MCP.

Pour une commande, il découpe les commandes enchaînées (`;`, `&&`, `|`…) et estime pour chacune si elle lit ou écrit les fichiers qu’elle nomme : `echo .env >> .gitignore` passe, `cat .env`, `Get-Content .env` ou `python -c "open('.env')"` sont refusés, `rm .env` demande confirmation. Un verbe inconnu est supposé lire et écrire. Une commande lancée par une autre est analysée pour ce qu’elle lance : `cmd /c "…"`, `& $env:ComSpec /c "…"`, `powershell -Command "…"` (y compris `-EncodedCommand`), `bash -c "…"`, `npx …`, `wsl …`.

La réponse est un objet `hookSpecificOutput` écrit sur la sortie standard, code de sortie 0 : `permissionDecision` vaut `deny` ou `ask`, et `permissionDecisionReason` commence par `[garde-fous <version>]` et se termine par `[règle <identifiant>]`. Un refus ajoute à ce que Claude lit un constat : obtenir le même résultat par un autre chemin contournerait la règle.

Le hook s’applique aussi aux appels des sous-agents : les hooks d’un plugin tournent dans les sous-agents comme dans la conversation principale.

## Configuration par projet

Un projet peut désactiver des règles dans `.claude/garde-fous.json`, à la racine du projet (le dossier que Claude Code désigne par `CLAUDE_PROJECT_DIR`) :

```json
{
  "desactiver": ["publication-paquet", "elevation-privileges"]
}
```

Ce fichier est protégé par la règle `config-garde-fous` : Claude peut le lire, mais il ne peut pas l’écrire. Un fichier mal formé est ignoré et ne désactive rien.

## Prérequis

- Node.js 20 ou plus récent dans le `PATH` : le hook lance `node` directement, sans shell. Il évite ainsi tout problème de guillemets avec un chemin contenant des espaces.
- Aucun réglage de Claude Code.

Pour voir ce que fait le hook : `claude --debug-file <fichier>` écrit dans ce fichier le détail de chaque exécution de hook.

## Limites

- **Les fichiers cités avec `@` dans un prompt ne passent pas par le hook.** Claude Code insère leur contenu en construisant le prompt, sans appel d’outil : aucun hook `PreToolUse` ne se déclenche. Pour interdire un chemin aux références `@`, ajoutez une règle de refus `Read` dans les permissions, ou définissez `CLAUDE_CODE_DISABLE_FILE_MENTIONS=1`.
- **Un hook voit les appels de Claude. Il ne voit pas le code des serveurs MCP.** Un serveur MCP malveillant qui lit lui-même vos fichiers et les envoie ailleurs n’appelle aucun outil : aucun hook ne peut l’en empêcher. La parade est en amont : n’installer que des serveurs de confiance, désactiver les outils inutiles.
- Les règles sur les commandes sont des heuristiques : elles arrêtent les maladresses et les injections ordinaires, pas un attaquant déterminé qui a la main sur le terminal (encodage, script intermédiaire…).
- En cas d’erreur interne, le hook laisse l’appel suivre son cours plutôt que de bloquer Claude. Pour Claude Code, un hook qui échoue ou dépasse son délai (10 s) n’empêche pas l’appel d’outil, sauf si le hook déclare `"onFailure": "block"`.
- Les noms d’outils évoluent avec les versions de Claude Code : après une mise à jour, vérifiez le comportement avec `claude --debug-file`.

## Modifier une règle

1. Éditez [scripts/regles.mjs](scripts/regles.mjs) : chaque règle y est décrite en tête de fichier, et le type `Regle` fournit l’autocomplétion des champs.
2. Ajoutez un cas dans `tests/garde-fous.test.mjs`, à la racine de la marketplace, et lancez `npm test`.
3. Incrémentez la version (mineure pour une règle ajoutée, correctif pour un faux positif) dans `.claude-plugin/plugin.json` du plugin **et** dans `.claude-plugin/marketplace.json`, puis notez le changement dans [CHANGELOG.md](CHANGELOG.md). La skill `publier-plugin` du plugin `atelier-plugins` fait les trois d’un coup.
