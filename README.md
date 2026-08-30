# O.C.T. FleetPro V2 — Fleet Management Portal

A self-contained fleet & equipment rental management portal. Everything is in a single
`index.html` file, so it deploys to GitHub + Vercel with zero build step.

## Demo logins
- **Admin:** `admin` / `admin123`
- **Staff:** `staff` / `staff123`

## What works
Every module now saves real data and maps it to the correct fields:

- Fleet / Equipment — add, edit, delete, search
- Rentals — add, edit, delete (auto-marks the fleet item "Rented")
- Maintenance — add, edit, delete
- Breakdowns — add, edit, delete (auto-marks the fleet item "Breakdown")
- Workshop work orders — add, edit, delete
- Location history — add, edit, delete
- Garage inventory — add, edit, delete (auto "Low Stock" flag)
- Staff — add, edit, delete **+ passport/license file uploads**
- Vehicle records — add, edit, delete **+ insurance/registration/inspection uploads**
- Documents & expiry — add, edit, delete **+ file upload**, auto Valid/Expiring/Expired status
- Users — add, edit, delete
- Reports — live figures + CSV export per table + JSON backup/restore
- Dashboard — real counts, live donut/bar charts, dynamic alerts

## How data is stored
- **Records** are saved in the browser's **localStorage** (survives refresh).
- **Uploaded files** are saved in the browser's **IndexedDB** and can be re-opened later.
- Use **Reports → Backup & Restore** to export a JSON backup (moves data to another device),
  import a backup, reset to demo data, or clear everything.

> Important: because this is a static site with no backend, data lives **per browser / per device**.
> Two different people on two computers will each have their own copy. For shared, multi-user
> data (one central database everyone sees), you'll need a backend + database — see "Next step" below.

## Required image files
The portal references two logo files. Put them in the **same folder** as `index.html`,
with these exact names (case-sensitive on Vercel):
- `Ottawa Logo Login.png` (login screen)
- `Ottawa Logo.png` (sidebar)

If they're missing, the app still works — the logos just hide automatically.

## Deploy to GitHub + Vercel
1. Create a new GitHub repository (e.g. `fleetpro`).
2. Upload `index.html`, the two logo PNGs, and this `README.md` to the repo.
3. Go to https://vercel.com → **Add New → Project** → import your GitHub repo.
4. Framework preset: **Other** (no build command, no output directory needed).
5. Click **Deploy**. Your site will be live at `https://<your-project>.vercel.app`.

Any push to GitHub redeploys automatically.

## Next step (optional): shared central database
To make all users share the same live data across devices, the natural upgrade is a small
backend — for example Vercel serverless functions + a hosted database (Vercel Postgres,
Supabase, or Firebase). The current forms map cleanly onto database tables, so this is a
straightforward extension when you're ready.
