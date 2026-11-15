# Eir CLI Reference

Live sources when anything looks stale: `eir --help`, `eir <command> --help`,
https://hermes-agent.nousresearch.com/docs/reference/cli-commands

### Global Flags

```
eir [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
eir chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
eir setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
eir model                Interactive model/provider picker
eir fallback [add|remove|list]  Fallback provider chain
eir config [show|edit|get|set|unset|path|env-path|check|migrate]
eir login / logout       OAuth sign-in / clear stored auth
eir doctor [--fix]       Check dependencies and config
eir status [--full]      Component summary (--full: every section)
```

### Tools & Skills

```
eir tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

eir skills list|browse|search QUERY|inspect ID
eir skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
eir skills config        Enable/disable skills per platform
eir skills check|update|uninstall|publish PATH
eir skills tap add REPO  Add a GitHub repo as a skill source
eir bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
eir mcp add NAME (--url or --command) | remove | list | test NAME
eir mcp catalog | install NAME     Curated catalog install
eir mcp configure NAME             Toggle tool selection
eir mcp-serve                      Run Eir as an MCP server (mcp-serve plugin)
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
eir gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `eir photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/

### Sessions

```
eir sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
eir cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
eir webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
eir profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
eir profile rename A B | alias NAME | export NAME | import FILE
eir profile migrate-identity A B   Retry a completed rename's session/routing identity migration
```

### Credentials & Pools

```
eir auth                 Interactive credential manager
eir auth add [PROVIDER]  Add OAuth or API-key credential (nous, openai-codex, qwen-oauth, …)
eir auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
eir desktop / gui        Native desktop app
eir dashboard            Web admin panel + embedded chat (--stop / --status)
eir proxy                OpenAI-compatible local proxy backed by an OAuth provider
eir portal               Quick setup / sign in via Nous Portal
eir kanban <verb>        Multi-agent work-queue board
eir project              Named multi-folder workspaces (see references/projects-and-folders.md)
eir skin list|use|set    Switch/tweak skins (see references/themes.md)
eir pets <verb>          Pet mascots (see references/petdex.md)
eir memory setup|status|off|reset   Memory provider
eir secrets bitwarden|onepassword   External secret stores
eir moa                  Mixture-of-Agents slots
eir hooks / security / backup / import / checkpoints / console
eir logs [-f] [errors]   View agent/error logs
eir send                 One-off message through a gateway platform
eir pairing / plugins / insights / journey / computer-use
eir acp                  ACP server (IDE integration)
eir completion bash|zsh|fish
eir update / uninstall
```

Plugin- and provider-supplied subcommands (e.g. `eir photon setup`) only appear once their plugin is installed/active. Importing from OpenClaw, Claude Code, Codex CLI or Cursor (`eir import-agent <agent>`, plus the older `eir claw migrate|cleanup`) comes from the `agent-importers` plugin; a fresh `eir setup` that finds one of those agents offers to install it.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `eir config edit` · [Configuration docs](https://hermes-agent.nousresearch.com/docs/user-guide/configuration) |
| Tools / toolsets | `eir tools list` · [Tools reference](https://hermes-agent.nousresearch.com/docs/reference/tools-reference) |
| Skills catalog | `eir skills browse` · [Skills catalog](https://hermes-agent.nousresearch.com/docs/reference/skills-catalog) |
| Provider setup | `eir model` · [Providers guide](https://hermes-agent.nousresearch.com/docs/integrations/providers) |
| Env variables | `eir config env-path` · [Env vars reference](https://hermes-agent.nousresearch.com/docs/reference/environment-variables) |
| Gateway logs | `~/.eir/logs/gateway.log` (or `eir logs`) |
| Sessions | `eir sessions browse` (reads state.db) |
