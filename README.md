# Intelligent Dead Reckoning · SIH 2026 · PS 26168

Placeholder website for the idea submission. The full prototype will replace it at the same address.

## Files

| File | What it is |
|---|---|
| `index.html` | The page (all styling inside, no build step) |
| `assets/system-flow.png` | End-to-end flowchart shown on the page |
| `assets/favicon.svg` | Browser-tab icon |
| `README.md` | This file |

## 1. Put it on GitHub

1. Create a new repository on GitHub, for example `sih26168-idr` (public or private both work with Vercel).
2. On the empty repository page choose **uploading an existing file** (or **Add file → Upload files**).
3. Drag in the **contents** of this folder: `index.html`, `README.md` and the `assets` folder. `index.html` must sit at the top level of the repository, not inside another folder.
4. Click **Commit changes**.

## 2. Deploy on Vercel

1. Sign in at vercel.com with your GitHub account (the free Hobby plan is enough).
2. **Add New → Project**, find the repository and click **Import**.
3. Framework Preset: **Other**. Leave the build and output settings empty. Click **Deploy**.
4. Open the project, then **Settings → Domains**. The production address there (usually `sih26168-idr.vercel.app`) is the link for the PPT. To get a nicer name, add another free `*.vercel.app` address there before you share it.
5. **Settings → Deployment Protection**: keep **Standard Protection** so the production address stays public.
6. Open the address in an incognito window to confirm it loads without a Vercel login.

Use only the production address in the PPT, never the long deployment URL with random characters.

## 3. Update it later

- Edit or replace the files in the same repository and commit. Vercel redeploys automatically and the address stays the same.
- When the real app replaces this page (React, Next.js, Vite and so on), push it to the same repository and set the matching Framework Preset once under **Settings → Build & Deployment**.
- If the real site is hosted somewhere else, add a `vercel.json` file to this repository with a temporary redirect:

```json
{
  "redirects": [
    { "source": "/:path*", "destination": "https://your-real-site.example/:path*", "permanent": false }
  ]
}
```

`"permanent": false` sends a 307 redirect, which browsers do not cache, so the target can be changed again later.
