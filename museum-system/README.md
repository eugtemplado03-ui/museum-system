# Museo Sang Bata sa Negros — QR Exhibit System

A full-stack museum exhibit system, seeded with real exhibit data from
[Museo Sang Bata sa Negros](https://museosangbata.org/) (a hands-on
children's museum in Sagay City, Negros Occidental, Philippines). Visitors
scan a QR tag next to any exhibit and instantly see its details on their
phone. Staff manage every exhibit — including uploading photos and
generating each exhibit's printable QR tag — from a password-protected
admin dashboard.

The 11 seeded exhibits (Under the Sea, The River, Splash Zone, Everyday
Heroes, JGM Memorabilia, Hampanganan, Biodiversity, Story of Plastic,
Carnival, Franco's Reading Corner, and the Mangrove Walk) and the footer's
address, hours and phone number are pulled from the museum's public
website. Descriptions are paraphrased summaries, not copied text — treat
them as a starting draft and edit freely from the admin dashboard. This is
an unofficial project, not built or endorsed by Museo Sang Bata sa Negros;
swap in your own branding and content just as easily if you'd rather use
this for a different museum.

## What's inside

- **Node.js / Express backend** with a REST API
- **Real authentication** — bcrypt-hashed passwords, JWT session tokens, rate-limited login
- **Image uploads** — admins attach a real photo per exhibit (stored on disk, served statically)
- **Server-generated QR codes** — each exhibit gets a unique, downloadable/printable PNG tag encoding a link straight to its page
- **Embedded JSON database** (`db/data.json`) — zero setup, no external database server required, fully portable. Swap in Postgres/MySQL later by editing `db/exhibits.js` and `db/users.js` if you outgrow it.
- **Plain HTML/CSS/JS frontend** — no build step, no framework — three pages:
  - `/` — visitor gallery + live camera QR scanner
  - `/exhibit.html?code=EX-001` — the page a scanned tag opens
  - `/admin.html` — curator sign-in + CRUD dashboard

## Quick start

```bash
npm install
cp .env.example .env       # then edit .env — set a real JWT_SECRET
npm run seed                # creates the first admin account + sample exhibits
npm start                   # http://localhost:3000
```

The seed script prints the admin username/password it created (defaults to
`admin` / `museum-admin-2026`, or whatever you set as `SEED_ADMIN_USER` /
`SEED_ADMIN_PASS` in `.env`). **Sign in and rotate this password before
using this in production** — `npm run seed` only creates an account if none
exists yet, so it's safe to leave in the codebase.

## Using it

1. Open `/admin.html`, sign in, and click **+ Add exhibit**. Fill in the
   details and optionally upload a photo.
2. Saving generates a catalog code (`EX-001`, `EX-002`, …) and a QR tag.
   Click **Tag** on any row to preview and download its PNG — print it and
   place it next to the physical exhibit.
3. Visitors open the site on their phone, tap **Open scanner**, and point
   the camera at a tag to jump straight to that exhibit's page. There's
   also a manual code field and a full browsable gallery as a fallback.

## How the QR code finds the right page

Each tag encodes a full URL: `https://<your-domain>/exhibit.html?code=EX-001`.
That means **the QR codes only resolve correctly once this app is running at
a real, publicly reachable URL** (see Deploying below) — while testing on
`localhost` the codes will still work if scanned by a phone that's on the
same network *and* using your machine's LAN IP instead of `localhost`.

## Programs, events & gallery

Three more content types, sourced from museosangbata.org and manageable
from their own admin tabs:

- **Programs** (`/programs.html`) — the museum's ongoing programs (Junior
  Museum Guide, Marine Conservation Education, etc.), each with an age
  range, schedule, photo, and description.
- **Events** (`/events.html`) — news and events, sorted newest first.
- **Gallery** (`/gallery.html`) — a photo grid with optional titles/captions.

**Only signed-in admins can add, edit, or delete these** — `POST`/`PUT`/
`DELETE` on `/api/programs`, `/api/events`, and `/api/gallery` all require
the same JWT auth as the exhibit catalog (see `middleware/auth.js`).
Anyone can view them (`GET` is public), same as exhibits. Image uploads
reuse the existing `/api/exhibits/upload-image` endpoint — it's a generic
uploader, not exhibit-specific, despite the URL.

## Visitor features

- **Favorites** — visitors tap the heart on any exhibit card or detail page to save it. No login needed; each device gets an anonymous `visitorId` stored in the browser and sent with requests. A "My favorites" filter on the homepage shows just their saved exhibits.
- **Ratings & feedback** — visitors rate an exhibit 1–5 stars with an optional comment from its detail page. The average and recent comments are shown to other visitors on that page. Each visitor can rate a given exhibit once — submitting again updates their existing rating rather than adding a duplicate.
- **Scan analytics** — every time an exhibit page loads, the system logs whether it came from a QR scan or a direct link/tap. This powers the admin Analytics tab (see below) so you can see which exhibits actually get scanned on the floor, not just clicked in the gallery.

## Admin dashboard tabs

The dashboard now has three tabs:
- **Catalog** — the original CRUD table, now also showing each exhibit's average rating and favorite count at a glance.
- **Analytics** — all-time / 7-day / 24-hour view totals, a per-exhibit breakdown of QR scans vs. other views, and a recent-activity log.
- **Feedback** — every rating and comment submitted, with the exhibit it belongs to, and a Remove button for moderation.

The **Museum Info** tab manages the shared museum name, tagline, address,
phone, hours, visitor fees, About-page copy, contact details, donation
opportunities, and bank deposit instructions. Changes are stored with the
museum information record and appear on the public About, Contact, Donate,
header, and footer surfaces.

Admins can also use **Arrange & Resize Sections** on the floor map to drag
room and facility sections. Dropping one section onto another swaps their
positions and displayed sizes. The selected section has resize handles on all
four sides; dragging one edge moves only that edge while the opposite edge
stays anchored. The corner handle adjusts width and height while keeping the
opposite corner fixed. Text inside resized or swapped sections scales
uniformly to stay readable, and successful swaps report the section names. On
mobile, the success and editing-tip messages are hidden so the search and
filter controls remain responsive; layout errors stay visible.
Category-room exhibit markers move and resize with their room. The shared map
layout is saved for all visitors; use **Reset Layout** to restore the original
positions and sizes.

## API Management

Administrators can open **Admin Dashboard → API Management** to configure the
Groq and Cloudinary integrations, and to add, edit, or remove custom provider
keys. Built-in credentials are encrypted in MongoDB and are never returned to
the browser. Custom keys are stored securely for management, but are not
connected to application features automatically.

The Groq usage panel records this app's daily request counts and provider-
reported input/output tokens for chat and translation. Speech requests and
characters are counted separately. It also shows the latest rate-limit headers
returned by Groq. Groq documents the request headers as organization-wide
requests per day (RPD) and tokens per minute (TPM), so remaining quota may
reflect other apps using the same organization. Usage history is retained for
up to 90 days; tracking requires MongoDB. This is not an account-wide billing
report, and the dashboard does not estimate cost.

Groq is used by the museum chat, description translation, and English
narration. Tagalog, Cebuano/Bisaya, and Hiligaynon narration use OpenRouter's
audio-output model. Cloudinary is used for remote image/video uploads and
database backups. Groq and Cloudinary can use server environment variables or
dashboard-managed credentials; OpenRouter narration uses server environment
variables.

For Groq, set the optional `GROQ_API_KEY` and `GROQ_MODEL` environment
variables, or enter a key from
[console.groq.com/keys](https://console.groq.com/keys) in API Management.
For local-language exhibit narration, set `OPENROUTER_API_KEY` in the server
environment. The default audio model is `openai/gpt-audio-mini`; optionally
override it with `OPENROUTER_TTS_MODEL` and select a supported voice with
`OPENROUTER_TTS_VOICE` (default `alloy`). The selected model must support
streaming audio output. Audio quality and language coverage depend on that
model, so test Tagalog, Cebuano/Bisaya, and Hiligaynon samples before
publishing. See
[OpenRouter's audio guide](https://openrouter.ai/docs/guides/overview/multimodal/audio)
for audio-output request details.
For Cloudinary, configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET`, or enter those credentials in API Management.

Managed credentials are encrypted in MongoDB using a key derived from
`JWT_SECRET`. Keep `JWT_SECRET` stable; if it is rotated, re-enter the
dashboard-managed credentials. Without an active Groq key, the chatbot uses
its local response engine.

## Museum chat assistant

The visitor pages include a chat widget that answers museum questions using
the live exhibit, program, and event catalogs together with museum information.
When configured, it calls Groq; otherwise it uses the local response engine.
The Groq key is shared by chat, translation, and English narration.

**If a key ever gets pasted somewhere it shouldn't (chat, a public repo,
etc.), treat it as compromised and rotate it immediately at
[console.groq.com/keys](https://console.groq.com/keys) — don't keep using it.**

Notes:
- Groq API usage may have costs and rate limits — there's a
  basic per-IP rate limit (30 messages / 10 minutes) baked in, but for a
  public kiosk you may want a stricter limit or a budget alert.
- The chatbot model is set by `GROQ_MODEL` in `.env` (defaults to
  `llama-3.3-70b-versatile`).
- To change what the assistant knows, edit `db/museum-info.js` (hours,
  fees, address) — exhibit, program, and event facts come straight from
  their respective catalogs, so editing them in the admin dashboard updates
  what the chatbot says automatically.



```
server.js              Express app entrypoint
db/
  store.js             Low-level JSON file read/write
  exhibits.js           Exhibit queries (list/create/update/delete)
  users.js               User queries
  favorites.js            Favorite queries
  ratings.js              Rating/feedback queries
  analytics.js            Scan/view event queries
  programs.js             Program queries
  events.js                Event queries
  gallery.js                Gallery photo queries
  museum-info.js          Static museum facts (hours/fees/address) for the chatbot
  data.json             The actual data file (created on first run)
middleware/
  auth.js               JWT verification
  upload.js             Multer image-upload config
routes/
  auth.js               POST /api/auth/login, GET /api/auth/me
  exhibits.js            Exhibit REST API + ratings + tracking + QR generation
  favorites.js            Favorites API
  admin.js                Admin-only analytics + feedback moderation
  programs.js              Programs API (public read, admin write)
  events.js                 Events API (public read, admin write)
  gallery.js                 Gallery API (public read, admin write)
  chat.js                 Museum-scoped chat assistant endpoint (Groq)
scripts/
  seed.js                Creates first admin user + sample exhibits/programs/events/gallery
public/                 Static frontend (served directly by Express)
  index.html, exhibit.html, admin.html, programs.html, events.html, gallery.html
  css/style.css
  js/api.js, admin.js, chatbot.js
uploads/                 Uploaded exhibit photos land here
```

## API reference

| Method | Route                          | Auth | Description |
|--------|--------------------------------|------|-------------|
| POST   | `/api/auth/login`              | —    | `{ username, password }` → `{ token, user }` |
| GET    | `/api/auth/me`                 | ✓    | Returns the decoded token payload |
| GET    | `/api/exhibits`                | —    | List all exhibits |
| GET    | `/api/exhibits/:code`          | —    | Get one exhibit by catalog code (e.g. `EX-001`) |
| GET    | `/api/exhibits/:code/qr`       | —    | Returns a PNG QR tag for that exhibit |
| POST   | `/api/exhibits`                | ✓    | Create an exhibit |
| PUT    | `/api/exhibits/:id`            | ✓    | Update an exhibit (by internal id) |
| DELETE | `/api/exhibits/:id`            | ✓    | Delete an exhibit |
| POST   | `/api/exhibits/upload-image`   | ✓    | Multipart image upload → `{ path }` |
| POST   | `/api/chat`                    | —    | `{ message, history }` → `{ reply }`. Museum-scoped assistant. |
| GET    | `/api/exhibits/:code/ratings`  | —    | Rating summary + list for one exhibit |
| POST   | `/api/exhibits/:code/ratings`  | —    | `{ visitorId, rating, comment }` — submit/update a rating |
| POST   | `/api/exhibits/:code/track`    | —    | `{ source: 'scan'\|'view' }` — logs a view for analytics |
| GET    | `/api/favorites/:visitorId`    | —    | List a visitor's favorited exhibits |
| POST   | `/api/favorites`               | —    | `{ visitorId, exhibitId }` — add a favorite |
| DELETE | `/api/favorites/:visitorId/:exhibitId` | — | Remove a favorite |
| GET    | `/api/admin/analytics`         | ✓    | View totals, per-exhibit breakdown, recent activity |
| GET    | `/api/admin/ratings`           | ✓    | All ratings across all exhibits |
| DELETE | `/api/admin/ratings/:id`       | ✓    | Remove/moderate a rating |
| GET    | `/api/programs`                | —    | List programs |
| POST/PUT/DELETE | `/api/programs[/:id]` | ✓ | Manage programs |
| GET    | `/api/events`                  | —    | List events, newest first |
| POST/PUT/DELETE | `/api/events[/:id]`   | ✓ | Manage events |
| GET    | `/api/gallery`                 | —    | List gallery photos |
| POST/PUT/DELETE | `/api/gallery[/:id]`  | ✓ | Manage gallery photos |

Authenticated routes expect `Authorization: Bearer <token>`.

## Deploying

This is a standard Node/Express app, so it runs on any Node host (Render,
Railway, Fly.io, a VPS, etc.):

1. Set real environment variables (`PORT`, `JWT_SECRET`, and optionally
   `SEED_ADMIN_USER` / `SEED_ADMIN_PASS`) — never commit `.env`.
2. Run `npm install --omit=dev && npm run seed && npm start`.
3. Make sure `db/data.json` and `uploads/` are on **persistent** storage —
   on platforms with ephemeral filesystems (e.g. some serverless/container
   setups), mount a persistent volume for both, or migrate to a real
   database and object storage.
4. Put it behind HTTPS (most hosts do this for you) — QR codes and login
   credentials should never travel over plain HTTP.

## Security notes (read before going live)

- Change `JWT_SECRET` and the seeded admin password — the defaults in this
  repo are for local development only.
- There's a basic in-memory login rate limiter; for production, consider a
  proper rate-limiting layer (e.g. at a reverse proxy) since in-memory
  limits reset on restart and don't share state across multiple instances.
- This system has a single `admin` role. If you need multiple staff
  accounts or permission levels, extend `db/users.js` and the auth routes.
