# VoltexAI — GitLab + Firebase deployment (backend on Render)

This routes VoltexAI around the suspended GitHub account:

```
Claude Code → Git → GitLab (code + CI)  → Firebase Hosting (frontend)
                                         → Render          (backend, unchanged)
```

- **GitLab** replaces GitHub as the code home and runs CI/CD.
- **Firebase Hosting** serves the React frontend (`voltexai/frontend/dist`).
- **Render** keeps running the FastAPI backend (`voltexai-api`) from `render.yaml`.

Everything code-side is already scaffolded in this repo:
`.gitlab-ci.yml`, `firebase.json`, `.firebaserc`. You only need to create the
accounts, wire two secrets, and push. **No secret is stored in the repo.**

---

## 1 · Put the code on GitLab

1. Create an empty project at <https://gitlab.com> (e.g. `owenphiri/voltexai`).
   Do **not** let GitLab add a README — keep it empty.
2. The `gitlab` remote is already configured in this repo (adjust if your path
   differs):
   ```
   git remote set-url gitlab https://gitlab.com/<you>/<project>.git
   ```
3. Push the branch (use a GitLab Personal Access Token with `write_repository`
   scope as the password when prompted):
   ```
   git push -u gitlab claude/voltex-pay-store-checkout
   git push gitlab main            # if you also want main mirrored
   ```
   > Set the project's **default branch** in GitLab so CI runs on your pushes,
   > or merge into `main`.

## 2 · Create the Firebase project (frontend host)

1. At <https://console.firebase.google.com> create a project, e.g. `voltexai-web`.
2. If the id differs from `voltexai-web`, update `.firebaserc` → `projects.default`.
3. Enable **Hosting** for the project. (Hosting alone does not require the Blaze
   plan; the free Spark plan is fine for static hosting.)
4. Generate a deploy token on a machine that has the Firebase CLI:
   ```
   npm install -g firebase-tools
   firebase login:ci        # prints a token — copy it
   ```

## 3 · Wire the two CI secrets in GitLab

Project → **Settings → CI/CD → Variables** → add (tick **Masked**, and
**Protected** if you only deploy from protected branches):

| Key                | Value                                   | Notes |
|--------------------|-----------------------------------------|-------|
| `FIREBASE_TOKEN`   | the token from `firebase login:ci`      | required |
| `FIREBASE_PROJECT` | your Firebase project id                | optional; else `.firebaserc` default |
| `VITE_API_URL`     | `https://voltexai-api.onrender.com`     | optional; already the built-in default |

That's it — the next push to the default branch (or `main`) builds the frontend
and deploys it to `https://<project>.web.app`.

## 4 · Keep the backend on Render (via GitLab)

Render currently deploys from GitHub, which is suspended. Point it at GitLab
instead — no code change needed:

1. Render Dashboard → the `voltexai-api` service → **Settings → Build & Deploy**.
2. Disconnect the GitHub repo and **connect the GitLab repo** (authorize Render's
   GitLab integration once).
3. Keep the existing settings from `render.yaml` (`rootDir: voltexai`,
   `buildCommand: pip install -r backend/requirements.txt`). Render auto-deploys
   on each GitLab push.

The frontend already calls the backend by its public Render URL, so once both
sides deploy from GitLab the system is fully wired again.

---

## What runs where — at a glance

| Piece            | Home            | Deployed by                    |
|------------------|-----------------|--------------------------------|
| Frontend (React) | Firebase Hosting| GitLab CI (`.gitlab-ci.yml`)   |
| Backend (FastAPI)| Render          | Render's GitLab auto-deploy    |
| Source + history | GitLab          | `git push gitlab`              |
| Durable backup   | Artifact vault  | auto (git post-commit hook)    |

## Notes
- `firebase login:ci` tokens are the simplest path; for a longer-lived setup you
  can instead use a **service-account** key with `GOOGLE_APPLICATION_CREDENTIALS`
  — the CI file's `firebase deploy` picks that up automatically if the token is
  absent.
- The GitHub reinstatement is still worth pursuing in parallel; this pipeline
  simply means you are no longer blocked by it.
