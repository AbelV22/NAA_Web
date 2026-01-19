# Skills & Lessons Learned

## GitHub Pages Deployment

### Bundle vs Modules
GitHub Pages can struggle with native ES Modules (`type="module"`) especially when using complex local imports or Worker paths that assume a specific directory structure.
**Recommendation:** Always use a bundled JavaScript file (e.g., `app.bundle.js`) for production deployments on GitHub Pages.

**How to Bundle:**
Use the provided PowerShell script `premium_app/bundle_app.ps1`.
```powershell
./bundle_app.ps1
```
This script concatenates all source files into a single `app.bundle.js`, removing `import`/`export` statements and ensuring `window.NuclearX` initializes correctly.

### Path Resolution
When deploying to subdirectories (like `/NAA_Web/`), absolute paths (starting with `/`) in HTML/CSS will break.
**Fix:** Use relative paths (`./js/...`, `./css/...`) or ensure the bundler/build process handles the base URL.

---

## Authentication Patterns

### Asynchronous Initialization (Race Conditions)
**Problem:** If the application initialization (`App.init()`) depends on user input (like a password), it must not proceed until that input is received. Synchronous checks will fail or the app will load in the background.

**Solution: Promise-Based Gate**
1.  **Gate Initialization:** The Gate's `init()` method should return a `Promise`.
    ```javascript
    init() {
        return new Promise((resolve) => {
            if (isAuthenticated) {
                resolve(true);
            } else {
                showLoginScreen(resolve); // Pass resolve as callback
            }
        });
    }
    ```
2.  **App Await:** The main App must `await` this promise.
    ```javascript
    async init() {
        await PasswordGate.init();
        // ... proceed with loading data ...
    }
    ```

### Session Persistence
**Behavior:** `localStorage` persists across browser sessions (tabs/windows) for the configured duration (default: 7 days).
**Implication:** If a user logs in once, they will not be prompted again for 7 days.
**Troubleshooting:** If "everyone" seems to have access, ensure you are testing in a fresh environment (Incognito Mode) or clear `localStorage`.

---

## PowerShell Execution Policies
**Issue:** `bundle_app.ps1` may fail with "running scripts is disabled on this system".
**Fix:** Run with bypass flag:
```powershell
powershell -ExecutionPolicy Bypass -File .\bundle_app.ps1
```

---

## Project Repository
**URL:** https://github.com/AbelV22/NAA_Web
**Branch:** main

