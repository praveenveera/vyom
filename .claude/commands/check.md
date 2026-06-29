Full health check — build everything, run all tests, report status.

Steps:
1. Run `npm run build` (builds all packages in dependency order via turbo)
2. If build fails, stop and show the TypeScript errors
3. Run `npm run test` (tests all packages)
4. Show a clean summary:
   - Build: ✅ / ❌
   - Tests: X passed / Y failed across N suites
   - Coverage: highlight any file below 80%
   - Any open issues to fix

This is the pre-commit check. Run it before creating a PR.
