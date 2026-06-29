Scaffold a new GarageBuild plugin package.

**Argument:** `$ARGUMENTS` — plugin name and type, e.g. `ollama model` or `react framework`

Parse the argument as: `<name> <type>` where type is one of `model | framework | deployment | agent`.

Create the following files (replace `{name}` with the plugin name):

**`packages/plugins/plugin-{name}/package.json`**
```json
{
  "name": "@garagebuild/plugin-{name}",
  "version": "0.1.0",
  "description": "GarageBuild {Name} plugin",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --passWithNoTests",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@garagebuild/plugin-sdk": "*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

**`packages/plugins/plugin-{name}/tsconfig.json`**
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`packages/plugins/plugin-{name}/garagebuild-plugin.json`** (the plugin manifest)
Fill in sensible values. The `id` field MUST equal `{name}` — this is the key used by PluginRegistry and ModelRouter.

**`packages/plugins/plugin-{name}/src/index.ts`**
Export the plugin class as default.

**`packages/plugins/plugin-{name}/src/{name}-plugin.ts`**
Stub implementation of the correct interface from `@garagebuild/plugin-sdk`:
- `model` type → implement `ModelPlugin`
- `framework` type → implement `FrameworkPlugin`
- `deployment` type → implement `DeploymentPlugin`
- `agent` type → implement `AgentPlugin`

All methods should throw `new Error('Not implemented')` initially except `getManifest()` and `getConfigSchema()` which should return real values.

After creating all files:
1. Run `npm install` to link the workspace
2. Run `npm run build --workspace=packages/plugins/plugin-{name}` to verify it compiles
3. Show a summary of what was created
