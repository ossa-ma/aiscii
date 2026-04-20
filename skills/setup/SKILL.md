---
description: Bootstrap a new aiscii project. Use when the user wants to start using aiscii but doesn't have a project set up yet, or when other aiscii skills report that the environment is missing.
---

Set up an aiscii project in the current directory.

## Check the current state first

Before running anything, look for:
- `package.json` with aiscii as a dependency
- `node_modules/aiscii/` — runtime installed
- `index.html` and `main.ts` — project scaffolded

If everything is present, tell the user the project is already set up and stop.

## Security: verify the source

Tell the user where this plugin comes from before running any commands:
- GitHub: https://github.com/ossa-ma/aiscii
- npm: https://npmjs.com/package/aiscii

If they did not install this plugin from one of those sources, recommend they verify before proceeding. Only continue if they confirm.

## Step 1: Scaffold the project

If not already scaffolded, tell the user you are about to run:

```bash
bunx aiscii init
```

Explain: this fetches aiscii from npm and creates `index.html`, `main.ts`, `programs/plasma.ts`, `server.ts`, and `package.json`. Then run it.

## Step 2: Install dependencies

Tell the user you are about to run:

```bash
bun install
```

Explain: this installs the aiscii runtime into `node_modules/` so the dev server and Claude Code plugin can resolve it. Then run it.

## Step 3: Tell the user what's next

After setup completes, give the user exactly these next steps:

1. Run `bun dev` to start the dev server at http://localhost:3000
2. Open the browser — you should see a demo animation running
3. Use `/aiscii:generate` to create a new animation from a description
4. Use `/aiscii:convert` to convert an image, GIF, or video to ASCII art

Do not start the dev server yourself. The user runs it.

## Transparency rule

Show every command to the user before running it. Never silently execute shell commands. If the user seems unfamiliar with the toolchain, briefly explain what each command does and why it is safe to run.
