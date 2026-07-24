# Division B — Club Health Console

A real, deployable web app: a public read-only dashboard plus an admin-only
console for adding/editing/deleting data. Built as plain HTML/CSS/JS with a
few small serverless API functions — no framework, so it deploys to Vercel
with almost no configuration.

## What you get after deploying

- **Public link** — `https://<your-project>.vercel.app/`
  (also reachable at `/divisionbfivestar`)
  Anyone can browse every dashboard and export to Excel. No editing.

- **Admin link** — `https://<your-project>.vercel.app/divisionbfivestaradmin`
  Asks for a username/password before showing anything. Once signed in,
  every "add / edit / delete" control in the app is unlocked.
  Default login: **username `divb`, password `Adhesh@db`** (see below to change it).

Both pages read and write the *same* shared data — an admin change shows up
on the public link within seconds.

## 1. Push this folder to GitHub

```bash
cd divisionb-app
git init
git add .
git commit -m "Division B club health console"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Or use GitHub Desktop / GitHub's "upload files" web UI if you'd rather not use the terminal.)

## 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo you just pushed.
2. Leave the framework preset as **"Other"** — no build command needed.
3. Click **Deploy**. It'll go live, but data won't save yet until step 3.

## 3. Add a Redis database (this is what makes data persist)

Vercel's own KV product was retired; the replacement is **Upstash Redis**,
installed the same way:

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database** → choose **Upstash** → **Redis**.
3. Once created, click **Connect to Project** and select this project.
4. This automatically adds the environment variables the app needs
   (`KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` — either naming works, the app reads both).
5. Go to **Deployments** and redeploy (or just push a commit) so the new
   environment variables take effect.

## 4. (Recommended) Set your own admin credentials & session secret

By default the admin login is `divb` / `Adhesh@db`, signed with a
built-in fallback secret. To set your own:

In **Project Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `ADMIN_USERNAME` | your chosen admin username |
| `ADMIN_PASSWORD` | your chosen admin password |
| `SESSION_SECRET` | any long random string (this signs the login cookie) |

Redeploy after adding these. If you skip this step, the app still works
with the defaults above — just less secure since the fallback secret is
visible in this source code.

## 5. Rename the project to get the exact `divisionbfivestar` link

In **Project Settings → General → Project Name**, rename it to
`divisionbfivestar`. Vercel will then serve the app at
`https://divisionbfivestar.vercel.app`, and the admin console at
`https://divisionbfivestar.vercel.app/divisionbfivestaradmin` — matching
what you asked for.

## Notes & honest limitations

- **This replaces the earlier Claude-artifact version.** That version's data
  lived inside Claude's own storage and only worked inside claude.ai — it
  won't carry over here. You'll re-enter clubs (bulk-paste still works —
  see "Manage Clubs & Areas" once signed in as admin).
- **Session length:** admin logins last 12 hours, then you'll need to sign
  in again.
- **Security model:** this is a single shared admin login (not per-person
  accounts), enforced server-side via a signed, HttpOnly cookie — a real
  improvement over the old client-side-only lock, appropriate for a
  small club/division tool. It is not built for handling sensitive personal
  data at scale.
- **Free tier is plenty** for a Division's worth of clubs — Upstash's free
  tier covers far more reads/writes than this app will generate.
