Build one or all GarageBuild packages.

**Argument:** `$ARGUMENTS`
- Empty or `all` → `npm run build` (builds everything via turbo, respects dependency order)
- Package name like `engine`, `plugin-sdk`, `plugin-ollama` → `npm run build --workspace=packages/$ARGUMENTS` or `npm run build --workspace=packages/plugins/$ARGUMENTS`

Steps:
1. Run the appropriate build command
2. Report success or show TypeScript errors clearly
3. If errors exist, show the file and line numbers so the user can jump straight to them
