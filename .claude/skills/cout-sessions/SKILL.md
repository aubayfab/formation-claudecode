---
name: cout-sessions
description: Affiche le coût et les tokens des dernières sessions Claude Code de ce projet, lus dans leurs transcriptions locales.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/scripts/cout-sessions.mjs" *)
---

Recopie le tableau ci-dessous tel quel, notes comprises, sans rien calculer ni commenter.

!`node "${CLAUDE_SKILL_DIR}/scripts/cout-sessions.mjs" ${CLAUDE_SESSION_ID}`
