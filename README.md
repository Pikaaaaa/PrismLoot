# PrismLoot

Demo CS2 case platform: crates, upgrades, contracts, battles, inventory, and live drops.

```bash
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Signed in as **NovaPrime** with demo credits.

### Database + admin

SQLite lives at `prisma/dev.db` (`DATABASE_URL="file:./dev.db"`). Copy `.env.example` to `.env`. The operator console URL is `ADMIN_PATH` (default `/pl-console-9f3k`, never `/admin`) and the password is `ADMIN_SECRET` (set a long random string). Case opens, vault grants, sells, gift cards, and deposits persist through `DATABASE_URL`. Gameplay UI still caches in `localStorage` (`prismloot-demo-v2`).

### Production (Vercel free + Neon free Postgres)

Do **not** deploy SQLite — the file disappears on each Vercel instance. Hobby stack: **GitHub → Vercel (Next.js) → Neon Postgres → Namecheap DNS**. Local `npm run dev` stays on `file:./dev.db`.

Vercel env (Production + Preview):

| Name | Example |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** URI (`…-pooler…?sslmode=require`) |
| `ADMIN_SECRET` | long random string (never commit) |
| `ADMIN_PATH` | `/pl-console-9f3k` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` (no trailing slash) |

`vercel.json` runs `prisma generate` + `db push` (Postgres schema) then `next build`. Seed **once** after the first successful deploy (upserts catalog/demo user; do not put seed in every build):

```bash
DATABASE_URL="postgresql://…" npm run db:seed
```

Steam login is not wired yet.

#### Owner clicks

1. **GitHub** — create a repo, first commit, `git push -u origin main` (nothing is on GitHub until you commit).
2. **Neon** — [console.neon.tech](https://console.neon.tech) → New Project → copy the **pooled** connection string.
3. **Vercel** — [vercel.com/new](https://vercel.com/new) → Import Git Repository → add the env vars above (all environments) → Deploy. First deploy needs `DATABASE_URL` or `db push` fails.
4. **Vercel domain** — Project → Settings → Domains → Add the Namecheap domain. Copy the DNS records Vercel shows (apex `A` / `CNAME`, `www` `CNAME` — do not invent IPs).
5. **Namecheap** — Domain List → Manage → Advanced DNS → paste those records → save. Wait for Vercel to show the domain Valid. Then set `NEXT_PUBLIC_SITE_URL` to `https://your-domain` and Redeploy.
