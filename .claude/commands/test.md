Run tests for a GarageBuild package.

**Argument:** `$ARGUMENTS`
- Empty or `engine` → `npm test --workspace=packages/engine`
- Any other package name → `npm test --workspace=packages/$ARGUMENTS` or `npm test --workspace=packages/plugins/$ARGUMENTS`
- `all` → `npm run test` (run all packages via turbo)

Steps:
1. Run the test command (tests require a prior build — run build first if dist/ is stale)
2. Show the test results summary: suites passed/failed, total tests, coverage table
3. If any tests fail, show the failure message and the exact assertion that broke
