# @garagebuild/cli

Command-line interface for GarageBuild. Built with Commander.js. Provides commands for workspace status, AI model management, project creation, and cost reporting.

## Commands

```
garagebuild status                          Show workspace, active model, plugin summary
garagebuild model list                      List all configured AI models
garagebuild model add                       Add a new AI model configuration
garagebuild model activate <id>             Set the active model
garagebuild model remove <id>               Remove a model configuration
garagebuild create <name>                   Create a new project (scaffolds via framework plugin)
garagebuild cost                            Show workspace cost summary
```

## Install & Build

```bash
npm install --workspace=packages/cli
npm run build --workspace=packages/cli
npm test --workspace=packages/cli
```

## Run (development)

```bash
node packages/cli/dist/cli.js --help
node packages/cli/dist/cli.js status
node packages/cli/dist/cli.js model add --provider openai --model gpt-4o --key sk-...
node packages/cli/dist/cli.js create my-react-app --framework react
```

## Architecture

The CLI initialises the GarageBuild engine on first command (`engine-factory.ts`) and shuts it down cleanly on exit. The engine is a singleton within a CLI invocation — one SQLite connection per run.
