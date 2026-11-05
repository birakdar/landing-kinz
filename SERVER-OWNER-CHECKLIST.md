# Kinz landing site — server owner checklist

**Repo (source of truth):** https://github.com/nazero3/landing-kinz  
**Branch:** `main`  
**Live site:** https://kinz-ed.com  

**Goal:** Serve production from this repo, enable GitHub Actions auto-deploy on every push to `main`, and make SEO crawl files (`robots.txt` / `sitemap.xml`) work correctly.

---

## A) Access (repo owner may do this)

- [ ] Add the server owner as a **Collaborator** (Write) on `nazero3/landing-kinz`, **or**
- [ ] Use a **deploy key** on the repo if they only need pull access (Actions deploy uses a separate SSH key to the VPS)

---

## B) Auto-deploy with GitHub Actions

The workflow already exists: `.github/workflows/deploy.yml`  
It runs on:

- every **push to `main`**
- manual run: **Actions → Deploy to production → Run workflow**

### B1. Server SSH setup

- [ ] Confirm the **nginx web root** path for kinz-ed.com (example: `/var/www/kinz-ed.com`)
- [ ] Create/use a Linux user that can **write** that web root
- [ ] Generate an SSH key pair for GitHub Actions deploy only (ed25519 recommended)
- [ ] Add the **public key** to that user’s `~/.ssh/authorized_keys`
- [ ] Keep the **private key** ready for the GitHub secret `SERVER_SSH_KEY` (do not commit it to the repo)

### B2. Enable GitHub Actions on the repo

- [ ] Open https://github.com/nazero3/landing-kinz/settings/actions
- [ ] Ensure Actions are **allowed** for the repository

### B3. Add repository secrets

Open: https://github.com/nazero3/landing-kinz/settings/secrets/actions  

Use the **same secret names as kinz-erp**:

| Secret | Required | What to put |
|--------|----------|-------------|
| `REMOTE_HOST` | Yes | Server IP or hostname |
| `REMOTE_USER` | Yes | SSH username that can write the web root |
| `SERVER_SSH_KEY` | Yes | Full private key text (including `BEGIN` / `END` lines) |
| `REMOTE_PATH` | Yes | Absolute nginx web root path |
| `REMOTE_PORT` | Yes | SSH port |
| `SSH_PASSPHRASE` | No | Passphrase for the key (leave empty / omit if none) |

### B4. First deploy test

- [ ] Go to https://github.com/nazero3/landing-kinz/actions
- [ ] Open **Deploy to production** → **Run workflow**
- [ ] Confirm the run is **green** (success)
- [ ] Confirm files on the server match the repo, including:
  - `index.html`
  - `english.html`
  - `manahij.html`
  - `skills.html`
  - `robots.txt`
  - `sitemap.xml`
  - `style.css`
  - `images/` (including `.webp` files)

### B5. Day-to-day behavior

After secrets work:

- [ ] Any push to `main` on `nazero3/landing-kinz` should update production automatically
- [ ] No manual `git pull` is required unless Actions fails

---

## C) SEO — serve real `robots.txt` and `sitemap.xml`

### Problem to fix

These URLs must **not** return the homepage HTML:

- https://kinz-ed.com/robots.txt
- https://kinz-ed.com/sitemap.xml

The correct files are already in the repo and are deployed with the site. Do **not** invent new content; serve the deployed files.

### C1. Confirm files exist on disk after deploy

```bash
# Replace with the real REMOTE_PATH
ls -la "$REMOTE_PATH/robots.txt" "$REMOTE_PATH/sitemap.xml"
head -5 "$REMOTE_PATH/robots.txt"
head -5 "$REMOTE_PATH/sitemap.xml"
```

Expected:

- `robots.txt` starts with `User-agent:`
- `sitemap.xml` starts with `<?xml`

### C2. Fix nginx (important)

Ensure `/robots.txt` and `/sitemap.xml` are **not** rewritten to `index.html`.

Example pattern:

```nginx
location = /robots.txt {
    try_files $uri =404;
}

location = /sitemap.xml {
    try_files $uri =404;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### C3. Verify from outside (must pass)

```bash
curl -sI https://kinz-ed.com/robots.txt
# Expect: Content-Type text/plain  (NOT text/html)

curl -sI https://kinz-ed.com/sitemap.xml
# Expect: Content-Type application/xml or text/xml  (NOT text/html)

curl -s https://kinz-ed.com/robots.txt | head
curl -s https://kinz-ed.com/sitemap.xml | head
```

### C4. Spot-check pages after deploy

- [ ] https://kinz-ed.com/
- [ ] https://kinz-ed.com/english.html
- [ ] https://kinz-ed.com/manahij.html
- [ ] https://kinz-ed.com/skills.html
- [ ] WhatsApp buttons open correctly
- [ ] Images load (including WebP)

---

## D) Optional (site owner after server work)

Not required from the server owner, but needed for SEO follow-up:

- [ ] Verify site in [Google Search Console](https://search.google.com/search-console)
- [ ] Submit sitemap: `https://kinz-ed.com/sitemap.xml`

---

## E) Final acceptance checklist (reply “done” when complete)

- [ ] Production source is `nazero3/landing-kinz` (`main`)
- [ ] GitHub Actions secrets `REMOTE_*` / `SERVER_SSH_KEY` / `SSH_PASSPHRASE` are set
- [ ] Manual **Deploy to production** succeeded
- [ ] Push to `main` would deploy without logging into the server
- [ ] Live `robots.txt` is plain text
- [ ] Live `sitemap.xml` is XML
- [ ] Course pages open on production
- [ ] Web root path is documented for future ops: `________________________`

---

## Short summary

1. Point production at **nazero3/landing-kinz**.  
2. Fill **REMOTE_*** / **SERVER_SSH_KEY** / **SSH_PASSPHRASE** secrets and prove Actions deploy works.  
3. Fix nginx so **robots.txt** and **sitemap.xml** are real static files.  
4. Confirm the live checks above.

After that, pushes to `main` update kinz-ed.com automatically, and search engines can crawl the site correctly.
