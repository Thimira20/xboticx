# XBOTIX 2026 — Website Architecture & Implementation Plan

> Single-page, mobile-first competition website for **XBOTIX** — *"the biggest robotics competition down south, where the best young minds in the country compete head to head."*
> Organized by EIES, Faculty of Engineering, University of Ruhuna.
>
> This file is the **source of truth** for the build. Each phase at the bottom has a ready-to-paste prompt for Sonnet.
> Items marked **[CONFIRM]** are facts the organizing committee must confirm. Until then, use the placeholder shown.

---

## PART A — The big questions, answered A to Z

### A1. Does this site need a backend?

**Yes, you need a backend. You do not need a server.**

A website has two halves:

| Half | What it does | Where it runs |
|---|---|---|
| **Frontend** | What people see: layout, countdown, timeline, forms | In the visitor's browser (HTML/CSS/JS files) |
| **Backend** | Things the browser must never do itself: save registrations, store uploaded letters, keep data private | On a machine you control |

Most of this site is frontend only: info, timeline, rulebooks, countdown. **Registration is the one feature that needs a backend.** A browser cannot write to your Google Sheet or Drive by itself without exposing your keys to everyone.

You have three options:

| Option | How it works | Verdict |
|---|---|---|
| **1. Frontend + embedded Google Form** | Put a Google Form in an iframe | ❌ Looks off-brand, and it's clumsy on mobile. **Google Forms file upload makes every respondent sign in with a Google account.** Many school students can't, or won't. |
| **2. Frontend + Google Apps Script** (serverless) | Your own forms POST to a free Apps Script "web app". The script writes to the Sheet and saves files to a private Drive folder. | ✅ **Recommended.** Free, no server to maintain, data goes straight into Google Sheets, and it easily handles a few hundred to a few thousand registrations. |
| **3. Full backend** (Node/Express, Firebase, Supabase) | A real server or BaaS with a database | ❌ Too much for a site that only runs for 2 months. It adds cost, hosting, maintenance and a login system, and the committee still wants an Excel-style sheet at the end. |

**Final answer: static frontend (hosted free) + Google Apps Script as the backend + Google Sheet as the database/admin panel + private Google Drive folder for letters.**

### A2. How does a registration travel? (example)

A student at *President's College, Embilipitiya* registers a team of 4 on their phone:

```
 Phone browser                     Google Apps Script (your backend)         Google Workspace
 ─────────────                     ─────────────────────────────────         ────────────────
 1. Fills 4-step form: school, district,
    4 members (name + phone), guardian
    (name, phone, NIC, relation)
 2. Picks the principal's letter PDF (1.3 MB)
 3. JS checks it's a PDF ≤ 5 MB,
    converts it to base64
 4. POST JSON ───────────────────▶ 5. doPost(e)
    (Content-Type: text/plain)        • honeypot / spam check
                                      • is registration open? (server clock)
                                      • validate every field again
                                      • check the file really is a PDF (magic bytes)
                                      • save file ─────────────────────────▶ Drive: /XBOTIX 2026/School letters/
                                      • lock → next ID "XB26-S-042"             XB26-S-042_Presidents-College.pdf (PRIVATE)
                                      • append row ────────────────────────▶ Sheet tab "School": 1 new row
                                      • send confirmation email ───────────▶ Gmail (if an email was given)
 7. Shows success screen ◀──────── 6. returns {ok:true, registrationId:"XB26-S-042"}
    "Your ID: XB26-S-042"
    + Copy ID + Add to calendar + WhatsApp group
```

The committee opens the Google Sheet and sees every team live. They click the letter link, check it, and set **Status → Verified**. Excel export is one click: *File → Download → .xlsx*.

### A6. Three safety features, explained simply

**1. Locking (stops clashing rows).**
*Problem:* At 11:58 pm on closing night, two teams press Submit in the same second. Both scripts read "last ID = 41" and both give themselves **XB26-S-042**. Two teams, one ID.
*Fix:* `LockService`. It works like one key for one room: the first script takes the key, gets ID 042 and writes its row, then gives the key back. The second script waits (under a second) and gets 043.
*Where:* only around "get next ID + write row" in `doPost` (E7). It's also what makes the "is this university registration number already in another team?" check reliable.

**2. Duplicate protection (stops the same team being saved twice).**
*Problem:* On weak mobile data, the phone sends the form and the server saves it, but the reply never reaches the phone. The student sees "error" and taps Retry. Without protection there are now **two rows** for the same team, and it keeps happening with every retry.
*Fix:* When the form opens, the browser makes a random ticket number (`submissionId`, e.g. `c1b2-…`) and sends it with every attempt. The server remembers the tickets it has seen. If the same ticket comes again, it doesn't make a new row. It just replies "you're already registered: XB26-S-042".
*Where:* `api.js` creates and reuses the ticket (E5). `doPost` checks it (E7). The same idea also blocks one university student (same registration number) from joining two teams.

**3. Registration ID + confirmation email (proof that it worked).**
*Problem:* Without proof, 300 teams message the committee: "Did my registration go through?"
*Fix:* Each team gets a short, readable ID: `XB26-S-042` = **XB**OTIX 20**26**, **S**chool (U = University), team number **042**. It's shown big on the success screen with a Copy button, and it's in the Sheet, so the committee can find the team in 2 seconds (Ctrl+F). If the team gave an email, a confirmation email with the ID and team details is sent too.
*Where:* the ID is created on the server inside the lock (so it's always unique). The email is sent after saving. If Gmail's daily limit (~100/day on a free account) is reached, the registration is still saved and the ID is still shown. Only the email is skipped.

**Image compression (only if photos are allowed).** The letter is **PDF only** (your requirement), so compression isn't needed by default. A browser can't make a PDF smaller anyway. If you later allow a *photo* of the letter (`upload.allowImages: true`), the phone shrinks a 4 MB camera photo to ~800 KB before sending. It stays readable and uploads about 5× faster on mobile data. Tip for students (shown under the upload box): *"No scanner? Use Google Drive → Scan, or iPhone Notes → Scan Documents, to make a PDF."*

### A3. "How are blogs managed?" — how does the content get updated?

You don't need a blog or a CMS. This site has very little changing content, and each type has a simple home:

| Content | Where it lives | Who edits / how |
|---|---|---|
| Dates, links, feature on/off switches | `js/config.js` | Developer, or any committee member via the GitHub web editor |
| History timeline, 2025 winners, sponsors, workshops, FAQ | `data/*.json` | Edit the JSON file on GitHub → site auto-redeploys in ~1 min |
| Rulebook PDFs | `assets/rulebooks/` | Upload a new PDF with a new version in its name (e.g. `school-rulebook-v1.1.pdf`) and update `config.js` |
| Registrations | Google Sheet | Nobody edits the site. Data flows in automatically. |
| *(optional, Phase 3)* Short announcements ("Rulebook v1.1 released!") | A tab in the same Google Sheet, read by Apps Script `doGet` | Committee types a row in the Sheet and it appears on the site with **no deploy** |

**Example:** sponsors confirm in November. Add them to `data/sponsors.json`, set `features.sponsors: true` in `config.js`, and commit. Netlify redeploys in about a minute and the Sponsors section shows up.

### A4. Hosting & domain

- **Host:** Netlify or Cloudflare Pages (free), connected to a GitHub repo. Every commit auto-deploys, and you get HTTPS and a CDN (fast in Sri Lanka).
  GitHub Pages also works, but Netlify/Cloudflare give you deploy previews and custom headers.
- **Domain [CONFIRM]:** e.g. `xbotix.lk`, or a subdomain from the university/faculty. If you have no domain yet, `xbotix.netlify.app` is fine.
- **Google account:** create a **dedicated committee Google account** that owns the Apps Script, Sheet and Drive folder. Don't use anyone's personal account, so ownership can be handed over to next year's committee.

### A5. Schedule reality check

Today is **25 Sep 2026**. If the event is in December and registration opens about 2 months earlier, **registration may open in ~3 weeks**.
→ Phase 1 (info site with "Registration opens in…" countdown) should go live ASAP.
→ Phase 2 (registration) **must be fully tested before `registrationOpens`**.
→ Phase 3 can finish while registration is already running.

---

## PART B — Requirement analysis

### B1. What you asked for (normalized)

| # | Requirement | Notes / decisions |
|---|---|---|
| R1 | Single page, rich, **mobile-first** | Most visitors come from WhatsApp/Facebook links on phones. Design at 360px first. |
| R2 | Two registration forms: **School** and **University**, teams of **2–5 members**, first member = leader | One form engine, two configs. Fields in E4. |
| R3 | School form needs a **guardian** (name, phone, NIC, relation: teacher/parent/other) and the **principal's verification letter** | Letter is **PDF only**, ≤ 5 MB. Goes to a **private** Drive folder. |
| R4 | All registrations in a **Google Sheet** | Two tabs (School / University) + Dashboard tab |
| R5 | Countdown: **registration opens → closes → competition starts** | Plus a 5th stage: *event ended* (post-event mode) |
| R6 | **Rulebook PDFs** downloadable | Versioned files, "updated on" label |
| R7 | **About** the competition | Plus categories, venue, FAQ |
| R8 | **History roadmap**: 2014, 2015, 2016, 2017, 2018, 2023, 2025 | Creative "circuit board" timeline. **Photo only for 2025 (winners).** |
| R9 | **Sponsors (creative)** — *not confirmed yet* | Built now, hidden behind a feature flag. Show a "Partner with us" CTA meanwhile. |
| R10 | **School workshop gallery** — *not done yet* | Built now, hidden behind a feature flag. Show a teaser meanwhile. |
| R11 | "Next level" modern UI/UX | See Part D (design system) |

### B2. Gaps I found in your requirements (things you'll need that weren't listed)

1. **Team name & contact email.** Your field list has neither. 2025 teams had names ("Byte Beasts"), and a confirmation email needs an address. Both are added as **optional** fields (E4). [CONFIRM: keep, make required, or remove]
2. **Registration fee?** [CONFIRM] If yes, you need a payment slip upload (same upload mechanism) and a "Payment" status column.
3. **Max teams per category?** [CONFIRM] Team size is fixed at 2–5 members. Max teams per category: placeholder unlimited.
4. **Sub-categories / challenges?** [CONFIRM] If the school and university categories have different tasks (line follower, robo-soccer…), add a "challenge" dropdown.
5. **Privacy of minors.** School students are under 18. You need a consent checkbox, a short privacy note, and the Sheet shared **only** with the committee.
6. **Confirmation for the team.** A registration ID on screen + an email. Without it, the committee gets flooded with "did my registration go through?" messages.
7. **FAQ + contact via WhatsApp.** Cuts down repeat questions.
8. **Venue/map.** Faculty of Engineering, Hapugala, Galle. [CONFIRM]
9. **Post-event mode.** After competition day the site should say "Thank you — see you in 2027" and show winners, not a dead countdown.
10. **Link previews.** People will share on WhatsApp, so the site needs an Open Graph image, title and description.

### B3. Assets you have and what's missing

| Asset | Status | Action |
|---|---|---|
| `logo.png` (1800×1800, transparent, **white "BOTI" wordmark**) | ✅ | Works on dark backgrounds only. **Ask the designer for the original SVG/AI file.** Meanwhile, rebuild the hexagon "X" mark as inline SVG so it can animate. |
| `images.jfif` (logo on black, 447px) | ✅ | Use as reference / favicon source |
| `2025 winner/images (4).jfif` — *School · Most Popular Team · Byte Beasts, President's College Embilipitiya · LKR 10,000* | ⚠️ 447px social-media poster | Usable for now. **Ask for the raw high-res photo** (≥1600px) and posters for the other 2025 winners (Champions, Runners-up, University category). |
| `past event photos/*` (2023 robots, 640–678px, with a watermark strip) | ⚠️ low-res | Use as **background texture only** (hero/about, darkened). Ask REF Media for originals. |
| `.jfif` files | ⚠️ | They're normal JPEGs. Rename to `.jpg` and convert to **WebP** (squoosh.app) under 200KB each. |
| Rulebook PDFs | ❌ | Placeholder PDFs until the committee delivers them |
| Stats (teams, schools, districts per year) | ❌ | [CONFIRM] Needed for the stat counters and the timeline |
| 2014–2018 details | ❌ | [CONFIRM] Even one line per year ("1st edition — 20 teams") makes the timeline feel real |

Brand extracted from the assets:
- **Colors:** near-black `#0A0A0B`, logo red gradient `#FF4A2E → #D30000`, white.
- **Motifs:** hexagons (honeycomb "X"), the `)•(` bracket-dot glyph, the 2025 tagline *"Sharpen • Sync • Strike"*. 2026 theme [CONFIRM].
- **Edition count:** 2014, 15, 16, 17, 18, 23, 25 = 7 editions, so 2026 = **8th edition** [CONFIRM].

---

## PART C — Review of the architecture Claude gave you

**Keep (it's correct):**
- Static HTML/CSS/vanilla JS, no framework, no build step. Right call for a 2-month site maintained by students.
- Google Apps Script as the API, Google Sheet as storage, Drive for files.
- `Content-Type: text/plain` to avoid the CORS preflight, then `JSON.parse(e.postData.contents)`. This is the key trick and it's correct.
- Data-driven sections from JSON, dates in a config file, private Drive folder, secrets only on the server.

**Problems and missing pieces (fixed in this plan):**

| # | Issue in the original | Why it matters | Fix |
|---|---|---|---|
| 1 | Registration window enforced **only in the browser** | Anyone can edit JS or change the phone clock and submit after closing | Server re-checks dates stored in Script Properties |
| 2 | No **concurrency lock** | Two teams submitting in the same second can collide or get the same ID | `LockService` around ID generation + `appendRow` |
| 3 | No **duplicate protection** | Bad mobile data → timeout → user taps again → 2 rows | Client sends a `submissionId` (UUID). Server returns the existing ID if it has seen it before. |
| 4 | No **spam protection** | The Apps Script URL is public | Honeypot field + minimum fill time + per-email rate limit (+ optional Cloudflare Turnstile) |
| 5 | No **server-side validation** or file checks | Anyone can POST junk or a 40MB file | Validate every field again. Check size and **file magic bytes** (PDF/JPEG/PNG). |
| 6 | Accepted big images for the letter | A 5MB photo becomes ~6.7MB as base64: slow or failing on mobile data | Letter is **PDF only** (≤5 MB). Optional photo mode compresses images on the phone first (E8). |
| 7 | No registration ID or confirmation email | Committee gets swamped with "did it work?" | ID like `XB26-S-042` + confirmation email (best effort) |
| 8 | Wrong form fields | Didn't match what the committee actually needs | Exact committee field list (Part E4): 2–5 members, guardian + NIC, uni reg no + year |
| 9 | Horizontal-scroll timeline | Awkward on phones, and it hides content | **Vertical** circuit timeline on mobile, horizontal on desktop |
| 10 | 4 countdown stages | After the event, the site looks broken | Add `ended` stage + post-event mode |
| 11 | Sponsors always shown | You have no sponsors yet, so an empty tier grid looks bad | Feature flags + "Partner with us" CTA; workshop section flag too |
| 12 | Plain long form | High drop-off on mobile | **4-step wizard** with autosave, progress bar and review step |
| 13 | Timezone not specified | A date with no offset is read in the visitor's local timezone | All dates as ISO with `+05:30` |
| 14 | No admin workflow | The committee needs to verify letters | `Status` dropdown column, `Notes`, Dashboard tab with counts |
| 15 | No setup automation | Manual sheet/folder setup causes mistakes | One-time `setup()` function creates tabs, headers, folders, properties |
| 16 | Redeploy gotcha not mentioned | "New deployment" creates a **new URL** and breaks the live site | Always use *Manage deployments → Edit → New version* |
| 17 | Missing: FAQ, venue, OG tags, a11y, reduced motion, performance budget | Quality and shareability | Covered in Phases 1 and 3 |

---

## PART D — Final architecture

### D1. System diagram

```
                ┌────────────────────────────── GitHub repo ──────────────────────────────┐
                │ index.html · css/ · js/ · data/*.json · assets/ · apps-script/Code.gs    │
                └───────────────┬──────────────────────────────────────────────────────────┘
                                │ auto-deploy on commit
                                ▼
┌──────────────┐   HTTPS   ┌──────────────────┐
│ Visitor phone│◀─────────▶│ Netlify / CF CDN │  static files only (no secrets)
└──────┬───────┘           └──────────────────┘
       │ POST text/plain JSON (register)            GET ?action=status (optional, Phase 3)
       ▼
┌────────────────────────────────────────────┐
│ Google Apps Script Web App  (Code.gs)      │  Execute as: committee account
│  doPost → validate → Drive → Sheet → Mail  │  Access: Anyone
│  doGet  → status / announcements / counts  │  Script Properties: SHEET_ID, FOLDER_ID,
└───────┬───────────────┬───────────────┬────┘  REG_OPEN, REG_CLOSE, counters
        ▼               ▼               ▼
  Google Sheet     Google Drive      MailApp
  School |         XBOTIX 2026/      confirmation
  University |     ├ School letters  emails
  Dashboard |      (PRIVATE)
  Log | Announce.
```

### D2. File structure

```
/index.html
/PLAN.md                      ← this file
/README.md                    ← how to run locally, deploy, update content (Phase 3)
/css/
  styles.css                  ← tokens, base, layout, components, sections, utilities (one file, @layer)
/js/
  config.js                   ← window.XBOTIX_CONFIG (dates, API URL, flags, links, rulebooks)
  main.js                     ← entry (type="module"): boots every module
  modules/
    stage.js                  ← stage engine (before-open / open / closed / live / ended)
    countdown.js              ← countdown UI bound to the stage engine
    nav.js                    ← mobile bottom bar, desktop top nav, scroll-spy
    hero.js                   ← hex-logo assembly animation, background
    timeline.js               ← circuit timeline rendering + scroll draw
    sections.js               ← winners, sponsors, workshops, FAQ, rulebooks renderers
    reveal.js                 ← IntersectionObserver scroll reveals, count-up stats
    register/
      wizard.js               ← steps, progress, navigation, review
      fields.js               ← field schemas for school & university
      validate.js             ← validation rules (mirrors server)
      upload.js               ← PDF checks, base64 (+ optional image compression)
      draft.js                ← localStorage autosave/restore
      api.js                  ← fetch with timeout, retry, idempotency
    util.js                   ← $, el(), fetchJSON, uuid, formatters, ics generator
/data/
  timeline.json
  winners.json
  sponsors.json
  workshops.json
  faq.json
/assets/
  img/logo/                   ← logo.png, logo-mark.svg, favicon.svg, og-image.jpg (1200×630)
  img/winners/                ← 2025-school-most-popular.webp
  img/bg/                     ← darkened 2023 robot photos (webp)
  img/sponsors/               ← (later)
  img/workshops/              ← (later)
  rulebooks/                  ← school-rulebook-v1.0.pdf, university-rulebook-v1.0.pdf
/apps-script/
  Code.gs                     ← paste-ready backend
  README-apps-script.md       ← step-by-step setup & deploy
```

**Local dev:** ES modules and `fetch()` of JSON **don't work over `file://`**. Always run a local server: VS Code "Live Server", or `npx serve .`.

### D3. Page structure (one scrolling page)

| # | Section (`id`) | Content |
|---|---|---|
| 0 | Nav | **Mobile: bottom tab bar** (Home · About · History · Rules · **Register** as a raised red hexagon button). **Desktop: glass top bar.** Scroll-spy highlights the current section. |
| 1 | `#home` Hero | Animated hex "X" logo assembly, "XBOTIX 2026 · 8th Edition", tagline, **stage-aware countdown**, primary CTA (changes with stage), secondary CTA "Rulebooks" |
| 2 | `#stats` Stat strip | Count-up: *7 editions · 12 years · N+ teams · N schools* [CONFIRM] |
| 3 | `#about` About | Mission copy, "what happens on competition day", **two category cards** (School / University: eligibility, team size, rulebook, register) |
| 4 | `#dates` Key dates | 2026 mission stepper: Registration opens → Registration closes → *(optional: robot inspection / briefing)* → Competition day. The current step glows. |
| 5 | `#history` Legacy | **Circuit-board timeline** 2014 → 2025 → 2026 (details in D4) |
| 6 | `#winners` Hall of Fame 2025 | Winner card(s) from `winners.json` (currently: Byte Beasts) |
| 7 | `#workshops` School workshops | `features.workshops` false → teaser "XBOTIX School Workshop Series — coming soon" + "Invite us to your school" (mailto/WhatsApp). True → masonry gallery. |
| 8 | `#partners` Sponsors | `features.sponsors` false → "Partner with XBOTIX 2026" CTA card (reach, audience, contact). True → honeycomb logo wall. |
| 9 | `#rules` Rulebooks | Two cards: title, version, updated date, size, **View** + **Download** |
| 10 | `#register` Registration | Stage-aware: before-open → countdown + "Get notified" (WhatsApp group link). Open → tabbed School/University wizard. Closed → "Registration closed" + contact. |
| 11 | `#faq` FAQ | Accordion from `faq.json` |
| 12 | `#contact` Venue & contact | Venue, map (click-to-load iframe or static link), WhatsApp click-to-chat, email, socials |
| 13 | Footer | Logo, organizer (EIES, Faculty of Engineering, University of Ruhuna), socials, © |

### D4. Signature piece: the "Circuit Legacy" timeline

The creative "tree" for the years held (2014, 2015, 2016, 2017, 2018, 2023, 2025):

- A glowing **PCB trace** (SVG path) runs **vertically on mobile**, snaking left and right, and horizontally on desktop ≥1024px.
- Each held year is a **hexagonal solder pad** node: year in large mono type, edition number ("Edition 01"), and a one-line highlight.
- **Gaps are part of the story:** 2019–2022 and 2024 are drawn as a **dashed, dimmed "offline" trace** with a small label (e.g. *"2019–2022 · system paused"*) [CONFIRM wording]. Gaps are computed automatically from the years, with an optional custom label in the JSON.
- **2025 node** is bigger: it holds the **only photo** (winners), and tapping it scrolls to Hall of Fame.
- **2026 node** at the end **pulses red** — "Edition 08 · You are here" — and links to Register.
- **Scroll-drawn:** as the user scrolls, the trace "powers on" (SVG `stroke-dashoffset` driven by scroll progress) and each pad lights up when reached (IntersectionObserver). With `prefers-reduced-motion`, everything is simply shown fully lit.

```
 mobile (vertical)                          desktop (horizontal)
 ● 2014  Edition 01                         2014──2015──2016──2017──2018 ┄┄┄┄ 2023 ┄ 2025 ══ 2026
 │                                           ⬡     ⬡     ⬡     ⬡     ⬡  paused  ⬡  gap  ⬡📷   ◉ pulse
 ● 2015  Edition 02
 │ …
 ● 2018  Edition 05
 ┆  2019–2022 · system paused (dashed)
 ● 2023  Edition 06
 ┆  2024
 ⬢ 2025  Edition 07  [winners photo]
 ║
 ◉ 2026  Edition 08 · YOU ARE HERE  → Register
```

### D5. Stage engine (single source of truth for time-based UI)

```
stage = before-open   now <  registrationOpens
        open          registrationOpens ≤ now < registrationCloses
        closed        registrationCloses ≤ now < competitionStarts
        live          competitionStarts ≤ now < competitionEnds
        ended         now ≥ competitionEnds
```

- Computed on load and every second. Emits a `stagechange` event. Countdown, hero CTA, key-dates stepper, register section and nav badge all subscribe.
- Countdown target & label per stage: *"Registration opens in"*, *"Registration closes in"*, *"Competition starts in"*, *"🔴 LIVE — competition in progress"*, *"XBOTIX 2026 is complete — see you in 2027"*.
- Last 48h before closing → an urgency style ("Closing soon", red pulse).
- Pause the interval when the tab is hidden (`visibilitychange`).
- **Dev override:** `?stage=open` (or `?now=2026-11-01T10:00:00+05:30`) in the URL forces a stage, so every state can be tested. Overrides are ignored when `config.debug` is false. They only change the UI: the server always uses its own clock.
- Phase 3 (optional): correct clock skew using `serverTime` from `doGet?action=status`.

---

## PART E — Specifications (contracts Sonnet must follow exactly)

### E1. Design system

**Direction:** "Arena at night". Deep black, red energy, hexagon geometry, precise mono numerals. Premium and technical, not a gaming cliché. Dark theme only (matches the brand).

```css
:root{
  /* color */
  --bg:#0A0A0B; --bg-2:#111114; --surface:#16161A; --surface-2:#1E1E24;
  --line:rgba(255,255,255,.08); --line-strong:rgba(255,255,255,.16);
  --text:#F5F5F7; --text-2:#A1A1AA; --text-3:#6B6B75;
  --red:#E3120B; --red-bright:#FF3B2F; --red-deep:#B00000;
  --grad-red:linear-gradient(135deg,#FF4A2E 0%,#D30000 100%);
  --glow-red:0 0 24px rgba(227,18,11,.45),0 0 64px rgba(227,18,11,.18);
  --ok:#22C55E; --warn:#F59E0B; --err:#FF5A52;
  /* type */
  --font-display:"Unbounded",system-ui,sans-serif;   /* headings, wide geometric, matches wordmark */
  --font-body:"Manrope",system-ui,sans-serif;        /* body/UI */
  --font-mono:"JetBrains Mono",ui-monospace,monospace;/* countdown, years, IDs */
  --fs-hero:clamp(2.4rem,8vw,5.5rem); --fs-h2:clamp(1.8rem,5vw,3rem);
  --fs-h3:clamp(1.15rem,3vw,1.5rem); --fs-body:1rem; --fs-sm:.875rem;
  /* space & shape */
  --s-1:.25rem; --s-2:.5rem; --s-3:.75rem; --s-4:1rem; --s-6:1.5rem; --s-8:2rem; --s-12:3rem; --s-16:4rem;
  --radius:14px; --radius-lg:22px;
  --gutter:16px;  /* 24px ≥768, 32px ≥1024 */
  --maxw:1200px;
  --ease-out:cubic-bezier(.2,.8,.2,1);
  --nav-h-mobile:68px;
}
```

**Rules:**
- **Red text** only for large text or on elements ≥ 18px bold. Body-size red uses `--red-bright`. Body text is always `--text` / `--text-2`, so everything passes WCAG AA.
- **Hexagon language:** `clip-path: polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)` for the icon badges, the register FAB and timeline pads. The background uses a very faint SVG honeycomb pattern (`opacity .04`).
- **Cards:** `--surface` + 1px `--line` border + subtle inner top highlight. On hover/focus: border becomes red-tinted, lift 2px, glow. Glass effect (`backdrop-filter: blur(14px)`) **only** on nav and bottom sheets.
- **Section header pattern:** small mono eyebrow (`// 03 — LEGACY`) + big display heading + one-line subtitle.
- **Motion:** 200–600ms, `--ease-out`. Scroll reveals = fade + 16px rise, staggered 60ms. **Everything respects `prefers-reduced-motion: reduce`** (no transforms, no canvas animation, trace fully drawn).
- **Touch:** every tap target ≥ 44×44px. Inputs ≥ 16px font (stops iOS zoom).
- **Breakpoints (mobile-first, `min-width`):** 480, 768, 1024, 1280. Test at **360, 390, 768, 1024, 1440**.
- **Fonts:** Google Fonts with `preconnect` + `display=swap`. Only the weights you use (Unbounded 600/800, Manrope 400/600/700, JetBrains Mono 500/700).

**Key components:** `btn` (primary red gradient / ghost / hex FAB), `card`, `badge`, `countdown` (4 segment tiles with mono digits, label under each, digit change = 150ms vertical slide), `stepper`, `tabs` (segmented control), `field` (floating label, inline error, success tick), `dropzone` (file picker with preview thumbnail/PDF icon, size, remove), `toast`, `bottom-sheet`, `accordion`, `progress`.

### E2. Hero experience

1. Background: the darkened 2023 robot photo (`assets/img/bg/`, 15% opacity, grayscale + red duotone overlay) + faint honeycomb + a soft red radial glow behind the logo.
2. **Logo assembly animation:** the 9 hexagons of the "X" mark are an inline SVG (`logo-mark.svg`, hand-built to match `logo.png`). On load, each hex flies in from a random offset/rotation into place (staggered, total ≤1.2s). Then the `)•(` brackets snap in and a glow pulse runs. Plays once per session (`sessionStorage`).
3. Headline: **XBOTIX 2026**. Eyebrow: "8th Edition · Faculty of Engineering, University of Ruhuna". Sub: *"The biggest robotics competition down south, where the best young minds in the country compete head to head."*
4. Countdown tiles (D5) + a thin 3-segment progress bar underneath showing the season journey (Open → Close → Event).
5. CTA per stage: before-open → "Get notified" (WhatsApp group) · open → **"Register your team"** · closed → "View rulebooks" · live → "Follow live" (social link) · ended → "See the winners".
6. On devices with a fine pointer only: subtle parallax of the hex mark on pointer move. None on touch; mobile battery matters.

### E3. Data file schemas

**`js/config.js`**
```js
window.XBOTIX_CONFIG = {
  debug: false,                       // true enables ?stage= / ?now= overrides
  year: 2026, edition: 8,             // [CONFIRM]
  theme: "",                          // 2026 tagline [CONFIRM], e.g. "Sharpen • Sync • Strike" was 2025
  dates: {                            // ALWAYS with +05:30 [CONFIRM all]
    registrationOpens:  "2026-10-15T00:00:00+05:30",
    registrationCloses: "2026-11-30T23:59:59+05:30",
    competitionStarts:  "2026-12-12T08:00:00+05:30",
    competitionEnds:    "2026-12-12T18:00:00+05:30"
  },
  api: { url: "PASTE_APPS_SCRIPT_EXEC_URL", timeoutMs: 60000 },
  features: { sponsors:false, workshops:false, announcements:false, liveCount:false, turnstile:false },
  team:   { school:{min:2,max:5}, university:{min:2,max:5} },          // member 1 = leader
  upload: { maxMB:5, types:["application/pdf"], allowImages:false,      // allowImages:true adds image/jpeg,image/png + compression
            imageMaxPx:2000, imageQuality:0.8 },
  uniRegYears: { min:2018, max:2026 },                                  // allowed "registration year" range [CONFIRM]
  rulebooks: [
    { category:"school",     title:"School Category Rulebook",     file:"assets/rulebooks/school-rulebook-v1.0.pdf",     version:"1.0", updated:"2026-10-01", size:"1.2 MB" },
    { category:"university", title:"University Category Rulebook", file:"assets/rulebooks/university-rulebook-v1.0.pdf", version:"1.0", updated:"2026-10-01", size:"1.4 MB" }
  ],
  venue: { name:"Faculty of Engineering, University of Ruhuna", address:"Hapugala, Galle", mapUrl:"https://maps.google.com/?q=Faculty+of+Engineering+University+of+Ruhuna" },
  links: { whatsappGroup:"", whatsappContact:"94XXXXXXXXX", email:"", facebook:"", instagram:"", linkedin:"", youtube:"" },
  stats: [ {value:7,label:"Editions"}, {value:12,label:"Years of legacy"}, {value:0,label:"Teams",suffix:"+"}, {value:0,label:"Schools",suffix:"+"} ]
};
```
> The Sheet ID and Drive folder ID live **only** in Apps Script Script Properties, never in this file.

**`data/timeline.json`**
```json
{
  "editions": [
    { "year": 2014, "edition": 1, "title": "Where it began",  "highlight": "[CONFIRM one line]" },
    { "year": 2015, "edition": 2, "title": "",                "highlight": "" },
    { "year": 2016, "edition": 3, "title": "",                "highlight": "" },
    { "year": 2017, "edition": 4, "title": "",                "highlight": "" },
    { "year": 2018, "edition": 5, "title": "",                "highlight": "" },
    { "year": 2023, "edition": 6, "title": "The comeback",    "highlight": "" },
    { "year": 2025, "edition": 7, "title": "Sharpen • Sync • Strike", "highlight": "", "photo": "assets/img/winners/2025-school-most-popular.webp", "link": "#winners" }
  ],
  "gaps": [
    { "from": 2019, "to": 2022, "label": "System paused" },
    { "from": 2024, "to": 2024, "label": "Recharging" }
  ],
  "next": { "year": 2026, "edition": 8, "label": "You are here", "link": "#register" }
}
```

**`data/winners.json`**
```json
[
  { "year": 2025, "category": "School", "award": "Most Popular Team", "team": "Byte Beasts",
    "institution": "President's College, Embilipitiya", "prize": "LKR 10,000",
    "photo": "assets/img/winners/2025-school-most-popular.webp", "alt": "Byte Beasts team receiving the Most Popular Team award at XBOTIX 2025" }
]
```

**`data/sponsors.json`** (empty for now)
```json
{ "tiers": ["Title", "Platinum", "Gold", "Silver", "Partner"], "items": [] }
// item: { "name": "", "logo": "assets/img/sponsors/x.svg", "tier": "Gold", "url": "" }
```

**`data/workshops.json`** (empty for now)
```json
{ "items": [] }
// item: { "school": "", "district": "", "date": "2026-10-20", "photo": "assets/img/workshops/x.webp", "caption": "" }
```

**`data/faq.json`**
```json
[ { "q": "Who can participate?", "a": "..." }, { "q": "How many members per team?", "a": "..." },
  { "q": "What is the verification letter?", "a": "A letter from your principal confirming the students are from your school, signed and stamped, uploaded as a PDF (max 5 MB). No scanner? Use Google Drive → Scan or iPhone Notes → Scan Documents." },
  { "q": "Who can be the guardian?", "a": "A teacher, a parent, or another responsible adult (18+) who is responsible for the team on competition day." },
  { "q": "Is there a registration fee?", "a": "[CONFIRM]" }, { "q": "I didn't get a confirmation email", "a": "Check spam. Your Registration ID on the success screen is valid. Contact us on WhatsApp." },
  { "q": "Can one student be in two teams?", "a": "[CONFIRM] No. Each phone number (and each university registration number) can only be in one team." } ]
```

### E4. Registration fields (committee-defined)

Both categories are **team (group) registrations: minimum 2, maximum 5 members. Member 1 is always the team leader.**
Members start with 2 rows. "+ Add member" adds rows up to 5, and each extra row has a remove (×) button. Member 1's card shows a "Leader" badge.
All fields are **required** unless marked *(opt)*. *(opt)* fields were added by this plan (see B2 #1), and the committee can remove them.

**School category (4 steps)**

| Step | Fields |
|---|---|
| **1 · School** | School name · District (dropdown, 25 districts of Sri Lanka) · Team name *(opt)* |
| **2 · Members** (2–5) | For each member: Full name · Phone number. Member 1 is labelled **"Leader"**. |
| **3 · Guardian & letter** | Guardian name · Guardian phone · Guardian NIC · Relationship (segmented: **Teacher / Parent / Other**; if Other → "Please specify") · **Principal's verification letter** (**PDF only**, ≤ 5 MB) · Contact email *(opt, for confirmation email)* |
| **4 · Review** | Read-only summary with "Edit" per step · ☐ I confirm the information is correct · ☐ The guardian agrees to the rules and to event photos being published · Submit |

**University category (3 steps)**

| Step | Fields |
|---|---|
| **1 · University** | University name (dropdown of Sri Lankan universities + "Other" → text) · Faculty name · Team name *(opt)* |
| **2 · Members** (2–5) | For each member: Full name · WhatsApp/phone number · University registration number · Registration year (dropdown, e.g. 2018–2026). Member 1 is labelled **"Leader"**. · Contact email *(opt)* |
| **3 · Review** | Read-only summary with "Edit" per step · ☐ I confirm the information is correct · ☐ I agree to the rules and to event photos being published · Submit |

**Example (School):**
```
School: President's College, Embilipitiya   District: Ratnapura   Team: Byte Beasts
1. Kavindu Perera   077 123 4567  (Leader)
2. Nimesha Silva    071 234 5678
3. Ravindu Jayasena 076 345 6789
Guardian: W. M. Bandara · 070 456 7890 · NIC 198512345678 · Teacher
Letter: principal-letter.pdf (1.3 MB)
```

**Example (University):**
```
University: University of Ruhuna   Faculty: Faculty of Engineering   Team: Circuit Breakers
1. Sahan Wijesinghe  077 111 2222  EG/2022/4501  2022  (Leader)
2. Dilini Fernando   071 333 4444  EG/2022/4523  2022
```

**Validation rules (identical on client and server):**
- Required fields are non-empty after `trim()`. Names 2–80 chars. Team name (if given) 2–40 chars, letters/numbers/spaces/`-_&.'`.
- **Phone (all phone fields):** normalize (strip spaces/dashes/brackets, strip a `+94`/`94`/`0` prefix) → must match `^7\d{8}$` → stored as `+947XXXXXXXX`. Show as `077 123 4567`.
- **NIC (guardian):** old format `^\d{9}[VvXx]$` or new format `^\d{12}$`. Stored uppercase.
- **University registration number:** 3–30 chars, letters/digits and `/ - .` only, stored uppercase (formats differ per university, e.g. `EG/2022/4501`).
- **Registration year:** 4 digits within `config.uniRegYears.min..max`.
- **Members:** count within `team.min..max` (2–5). **No two members of the same team may share a phone number or registration number.**
- **Across teams (server only, inside the lock):** a university registration number already in another team → `VALIDATION` error "This registration number is already registered in team XB26-U-012". Same for a member phone number in another team of the same category. [CONFIRM rule]
- Relationship ∈ `Teacher | Parent | Other`. If `Other`, "specify" is required (≤ 40 chars).
- Email (if given): `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`.
- **Letter:** must be a PDF (MIME or `.pdf` extension + `%PDF` header on the client, `%PDF` magic bytes on the server), ≤ 5 MB. Only when `upload.allowImages` is true are JPG/PNG accepted (and compressed first, E8).
- Show errors inline under the field (`aria-describedby`), and focus the first invalid field on "Next".

### E5. API contract (frontend ⇄ Apps Script)

**Request:** `POST {api.url}`, header `Content-Type: text/plain;charset=utf-8`, body = JSON string:
```json
{
  "action": "register",
  "submissionId": "c1b2…uuid-v4",
  "category": "school",
  "team":     { "name": "Byte Beasts", "institution": "President's College, Embilipitiya", "district": "Ratnapura" },
  "members":  [
    { "name": "Kavindu Perera",   "phone": "+94771234567" },
    { "name": "Nimesha Silva",    "phone": "+94712345678" },
    { "name": "Ravindu Jayasena", "phone": "+94763456789" }
  ],
  "guardian": { "name": "W. M. Bandara", "phone": "+94704567890", "nic": "198512345678", "relation": "Teacher", "relationOther": "" },
  "email":    "",
  "file":     { "name": "principal-letter.pdf", "mimeType": "application/pdf", "size": 1363148, "base64": "JVBERi0x…(no data: prefix)…" },
  "consent":  { "accurate": true, "rules": true },
  "meta":     { "hp": "", "elapsedMs": 184000, "ua": "…", "turnstileToken": "" }
}
```
`members[0]` is always the leader. 2–5 items.

University variant (no `guardian`, `file` is `null`, `team.faculty` instead of `district`, and extra member fields):
```json
{
  "action": "register", "submissionId": "…", "category": "university",
  "team":    { "name": "Circuit Breakers", "institution": "University of Ruhuna", "faculty": "Faculty of Engineering" },
  "members": [
    { "name": "Sahan Wijesinghe", "phone": "+94771112222", "regNo": "EG/2022/4501", "regYear": 2022 },
    { "name": "Dilini Fernando",  "phone": "+94713334444", "regNo": "EG/2022/4523", "regYear": 2022 }
  ],
  "email": "", "file": null, "consent": { "accurate": true, "rules": true }, "meta": { "hp": "", "elapsedMs": 120000 }
}
```

**Success:** `{ "ok": true, "registrationId": "XB26-S-042", "duplicate": false }`
**Error:** `{ "ok": false, "code": "REG_NOT_OPEN|REG_CLOSED|VALIDATION|FILE_INVALID|RATE_LIMIT|SPAM|SERVER", "message": "Human readable", "fields": { "members.1.regNo": "Already registered in team XB26-U-012", "guardian.nic": "Invalid NIC" } }`
Field keys use dot paths (`team.district`, `members.0.phone`, `guardian.nic`, `file`) so the client can highlight the exact input.

**Optional GET (Phase 3):** `GET {api.url}?action=status` → `{ ok, serverTime, stage, counts:{school, university} }`, and `?action=announcements` → `[{date, text, link}]`.

**Client behavior:**
- `AbortController` timeout = `api.timeoutMs` (first Apps Script call can take 3–8s cold).
- While sending: button shows spinner + "Uploading letter… / Saving…". All inputs locked. `beforeunload` warning is on.
- On network error/timeout: toast "Couldn't reach the server. Your details are saved — tap Retry." **Retry reuses the same `submissionId`**, so there's no duplicate.
- On `VALIDATION`: map `fields` back to inputs and jump to that step.
- On success: clear the draft, show the success screen (ID in big mono, copy button, "Add to calendar" `.ics`, "Join WhatsApp group", "Register another team").

### E6. Google Sheet layout

One row = one team. Unused member columns (for teams smaller than 5) stay blank.

- **Tab `School`** columns:
  `Timestamp | Registration ID | Status | School | District | Team Name | Member Count | Leader Name | Leader Phone | M2 Name | M2 Phone | M3 Name | M3 Phone | M4 Name | M4 Phone | M5 Name | M5 Phone | Guardian Name | Guardian Phone | Guardian NIC | Guardian Relation | Letter | Contact Email | Email Sent | Submission ID | Notes`
  (`Guardian Relation` holds `Teacher`, `Parent`, or `Other: <specified text>`.)
- **Tab `University`** columns:
  `Timestamp | Registration ID | Status | University | Faculty | Team Name | Member Count | Leader Name | Leader Phone | Leader Reg No | Leader Reg Year | M2 Name | M2 Phone | M2 Reg No | M2 Reg Year | M3 … | M4 … | M5 … | Contact Email | Email Sent | Submission ID | Notes`
- Phone columns are formatted as plain text (so Sheets doesn't drop the `+`). NIC and Reg No are plain text too.
- `Status` = data-validation dropdown: `Pending` (default) · `Verified` · `Rejected` · `Waitlist`, with conditional formatting colors.
- `Letter` = `=HYPERLINK(url, "Open letter")`. The file stays private, so only committee accounts can open it.
- **Tab `Dashboard`:** totals per category, per district (`QUERY`/`COUNTIF`), registrations per day, verified vs pending.
- **Tab `Log`:** server errors (timestamp, code, message, submissionId). Never log file contents.
- **Tab `Announcements`** (Phase 3): `Date | Text | Link | Show (TRUE/FALSE)`.
- Share the Sheet **only** with committee emails (Editor for 2–3 admins, Viewer for others). Never "Anyone with the link".

### E7. Apps Script backend (`apps-script/Code.gs`) — required behavior

```
CONFIG via Script Properties: SHEET_ID, ROOT_FOLDER_ID, SCHOOL_FOLDER_ID, REG_OPENS, REG_CLOSES, (TURNSTILE_SECRET), (ADMIN_EMAIL)

setup()              one-time: creates Sheet tabs + headers + frozen row + Status dropdown + formatting,
                     Drive folders "XBOTIX 2026/School letters" (not shared), writes IDs to Script Properties.
doPost(e)            try {
                       body = JSON.parse(e.postData.contents)
                       if body.meta.hp non-empty OR elapsedMs < 8000        → return ok:true fake (silently drop spam)
                       now vs REG_OPENS/REG_CLOSES                          → REG_NOT_OPEN / REG_CLOSED
                       rate limit: CacheService key leaderPhone+category, 3 per 10 min → RATE_LIMIT
                       idempotency: CacheService/lookup by submissionId      → return existing ID, duplicate:true
                       validate(body) (same rules as E4, incl. 2–5 members,
                         NIC format, relation, regNo/regYear, no in-team repeats) → VALIDATION + fields
                       if school: decode base64, check size ≤5MB and magic bytes
                           (PDF → base64 starts "JVBER"; only if ALLOW_IMAGES: JPEG "/9j/", PNG "iVBOR") → FILE_INVALID
                         save file to SCHOOL_FOLDER_ID as "<submissionId>_<safe school name>.pdf" (no sharing change)
                       lock = LockService.getScriptLock(); lock.waitLock(30000)
                         re-check idempotency
                         cross-team check: any member phone (and, for university, regNo) already in the tab
                           → release lock, return VALIDATION with the clashing team's ID    [CONFIRM rule]
                         counter = next per category (Script Properties)
                         id = "XB26-S-" + pad3(counter)  /  "XB26-U-" + pad3
                         appendRow(...) with Status "Pending" (E6 column order; blank unused member columns)
                       lock.releaseLock()   (always in a finally block)
                       rename file to "<id>_<school>.pdf"; cache submissionId → id (6h)
                       if email given AND MailApp.getRemainingDailyQuota() > 0:
                         send branded confirmation email → mark Email Sent Y, else N
                       return {ok:true, registrationId:id, duplicate:false}
                     } catch(err) { log to Log tab; return {ok:false, code:"SERVER", message:"…try again"} }
doGet(e)             action=status | announcements (Phase 3); default → {ok:true, service:"xbotix"}
json_(obj)           ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
testRegisterSchool() / testRegisterUniversity()   run from the editor with sample payloads
```

**Deployment (in `README-apps-script.md`):**
1. Log in as the committee Google account → create a Google Sheet "XBOTIX 2026 Registrations" → *Extensions → Apps Script* → paste `Code.gs`.
2. Run `setup()` once and accept permissions (Sheets, Drive, Mail).
3. Set `REG_OPENS` / `REG_CLOSES` in *Project Settings → Script Properties* (same values as `config.js`).
4. *Deploy → New deployment → Web app* · Execute as **Me** · Who has access **Anyone** → copy the `/exec` URL into `config.js → api.url`.
5. **For code changes later: *Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy*.** The URL stays the same. (A "New deployment" gives a NEW URL.)
6. Test with `testRegisterSchool()`, then from the live site with `?stage=open` in debug mode.

**Known limits:** Consumer Gmail accounts can send **~100 emails/day** through MailApp (Workspace ≈1,500). If a day goes over, emails are skipped, the registration still succeeds, and `Email Sent = N`. Apps Script POST payload limit (~50MB) and 6-min execution time are far above our needs.

### E8. Upload pipeline (client)

**Default: PDF only** (committee requirement).
1. User picks a file: `<input type="file" accept="application/pdf,.pdf">`. Helper text: *"PDF only, max 5 MB. No scanner? Use Google Drive → Scan, or iPhone Notes → Scan Documents."*
2. Check it's a PDF: MIME `application/pdf` **or** `.pdf` extension (some Android file pickers send an empty MIME). Also read the first 4 bytes and check `%PDF`. Otherwise: "Please upload a PDF file."
3. Size > 5 MB → error: "Your PDF is 7.2 MB. Max is 5 MB. Try scanning in black & white or at lower quality."
4. Show a preview card: PDF icon + file name + size + ✓ + Remove button.
5. Convert with `FileReader.readAsDataURL` → strip the `data:application/pdf;base64,` prefix at submit time.
6. **Don't** store the file in localStorage (too big). The draft stores text fields only, and the restored draft shows "Please re-attach your letter."

**Optional photo mode (`upload.allowImages: true`, off by default)** — only if the committee decides to accept photos of the letter:
- `accept` adds `image/jpeg,image/png` (iOS converts HEIC to JPEG automatically).
- Images are **compressed on the phone** before upload: draw on a canvas at max 2000px on the long side → `toBlob('image/jpeg', 0.8)`, retry at 0.65 if still > 5 MB. A typical 4 MB camera photo becomes ~800 KB and stays readable.
- The server must then accept the JPEG/PNG magic bytes too (Script Property `ALLOW_IMAGES=true`).

### E9. Non-functional targets

- **Performance:** Lighthouse mobile ≥ 90 (Perf/A11y/Best/SEO). JS total ≤ 40KB (unminified OK), CSS ≤ 40KB. No libraries. Images WebP ≤ 200KB with `width/height`, `loading="lazy"` (except hero), `srcset` for the winner photo. LCP < 2.5s on 4G.
- **Accessibility:** semantic landmarks, one `h1`, labeled inputs, visible focus ring (red 2px + offset), `aria-live="polite"` for countdown stage label changes (**not** for every second), `aria-live` for form status, keyboard-operable tabs/accordion/wizard, alt text everywhere, contrast AA.
- **SEO/Share:** `<title>`, meta description, canonical, Open Graph + Twitter card with `og-image.jpg` 1200×630 (logo + "XBOTIX 2026 · Register now"), `theme-color #0A0A0B`, favicon SVG + PNG + apple-touch-icon, JSON-LD `Event` schema (name, dates, location, organizer).
- **Robustness:** no console errors; every JSON fetch has a fallback (a section hides itself gracefully if its data fails to load); works without the Apps Script (form shows the error, not a crash).
- **Privacy:** no analytics cookies. If analytics is needed, use Cloudflare Web Analytics (cookieless). Short privacy note under the form.

---

## PART F — Implementation phases

Each phase ends with a **deployable** site. Hand Sonnet **one phase at a time**, then review and test before moving on.

### PHASE 1 — Foundation, design system & full info site (goal: go live with "Registration opens in…")

**Scope**
1. Project scaffold exactly as in D2. Move/rename existing assets: `.jfif` → `.jpg` into `assets/img/…` (keep originals untouched in an `_source/` folder, which is excluded from deploy via `.gitignore` or kept out of the publish dir).
2. `css/styles.css` with `@layer reset, tokens, base, layout, components, sections, utilities;` and all tokens from E1.
3. `index.html`: all sections from D3 (semantic markup, section IDs, header pattern). Register section shows **stage-aware placeholder only** (no form yet).
4. `js/config.js` (E3) + `js/modules/stage.js` + `countdown.js` (D5), including `?stage=`/`?now=` overrides when `debug:true`.
5. Navigation: mobile bottom tab bar with center hex Register FAB, desktop glass top nav, smooth scroll, scroll-spy, and a safe-area inset (`env(safe-area-inset-bottom)`).
6. Hero (E2) with an inline SVG hex logo mark and the assembly animation.
7. Stats count-up, About + category cards, Key-dates stepper.
8. **Circuit Legacy timeline** (D4) from `timeline.json`: vertical on mobile, horizontal ≥1024px, auto gaps, scroll-drawn trace, 2025 photo node, pulsing 2026 node.
9. Hall of Fame 2025 from `winners.json`.
10. Workshops & Sponsors sections with feature-flag behavior (teaser/CTA now; the full renderers can be simple for now).
11. Rulebooks from `config.rulebooks` (placeholder PDFs), FAQ accordion from `faq.json`, Venue & Contact, Footer.
12. Scroll reveals, `prefers-reduced-motion` support everywhere.

**Done when**
- [ ] Looks polished at 360 / 390 / 768 / 1024 / 1440 with no horizontal scroll at any width.
- [ ] `?stage=before-open|open|closed|live|ended` (debug on) correctly changes the hero label, countdown target, CTA, stepper and register placeholder.
- [ ] Timeline shows 2014–2018, a dashed 2019–2022 gap, 2023, a dashed 2024 gap, 2025 with photo, and a pulsing 2026 node.
- [ ] Setting `features.sponsors`/`workshops` true with sample JSON renders those sections; false shows the CTA/teaser.
- [ ] Zero console errors. Works via `npx serve .`.

**Prompt for Sonnet — Phase 1**
```
You are building the XBOTIX 2026 competition website. Read PLAN.md in the project root fully before writing any code — it is the source of truth (architecture, design tokens, schemas, contracts).

Implement PHASE 1 ONLY (Part F → Phase 1 scope), following Parts D and E exactly:
- Scaffold the file structure from D2. Move existing images into assets/img/... as .jpg (copy; keep originals in _source/).
- Build index.html with every section from D3, css/styles.css using the E1 design system (@layer order given), and ES-module JS (js/main.js + js/modules/*).
- Implement the stage engine + countdown (D5) with debug overrides, the hero with an inline-SVG hexagon "X" logo-mark assembly animation (E2; rebuild the 9-hex mark to match assets/img/logo/logo.png), the Circuit Legacy timeline (D4) from data/timeline.json, Hall of Fame from data/winners.json, feature-flagged Workshops/Sponsors, Rulebooks from config, FAQ accordion, Venue/Contact, Footer.
- Registration section: stage-aware placeholder only. No form yet.
- Create all data/*.json files with the placeholder content from E3; mark unknown facts with "[CONFIRM]" in data, never invent statistics or history.
Constraints: vanilla HTML/CSS/JS, no libraries, no build step; mobile-first; respect prefers-reduced-motion; tap targets ≥44px; semantic, accessible markup; no console errors.
Work section by section; after each section, check it at 360px and 1024px widths mentally against the "Done when" list. At the end, list every [CONFIRM] placeholder you used and anything you deviated from in PLAN.md and why.
```

---

### PHASE 2 — Registration system end-to-end (goal: tested and live before `registrationOpens`)

**Scope**
1. `register/fields.js`: School & University field schemas (E4), driven by config limits (2–5 members).
2. `register/wizard.js`: segmented tabs School/University → wizard. **School: 4 steps** (School → Members → Guardian & letter → Review). **University: 3 steps** (University → Members → Review). Includes a progress bar, Back/Next, per-step validation, member rows (start with 2, "+ Add member" up to 5, remove ×, member 1 = "Leader" badge), Teacher/Parent/Other segmented control with conditional "Please specify", review summary with "Edit" links, and consent checkboxes.
3. `register/validate.js`: rules from E4 (phone normalization, NIC old/new format, uni reg no + reg year, lengths, member count, no repeated phone/reg no inside a team, optional email).
4. `register/upload.js`: E8 pipeline, PDF only by default (dropzone, `%PDF` check, 5 MB limit, preview card, base64). The compression code path only runs when `upload.allowImages` is true.
5. `register/draft.js`: autosave text fields to localStorage per category (debounced 500ms), restore banner "We restored your draft · Start over", and clear on success.
6. `register/api.js`: E5 client behavior (text/plain POST, timeout, retry with the same `submissionId`, error mapping, honeypot field hidden off-screen, `elapsedMs`).
7. Success screen (ID, copy, `.ics` download, WhatsApp group, register another).
8. Stage integration: the form only renders in the `open` stage. If the stage flips to `closed` while the user is filling it in, show a banner and disable submit (the server is still the final authority).
9. `apps-script/Code.gs` per E7, with `setup()`, `doPost`, `doGet`, validation mirroring E4, magic-byte check, LockService, idempotency, rate limit, counters, email template (branded HTML: logo, ID, team summary, next steps, rulebook links, WhatsApp link), Log tab, and test functions.
10. `apps-script/README-apps-script.md` with the deployment steps from E7 (including the "Manage deployments → New version" warning).

**Done when**
- [ ] School team of 3 + guardian + a 1–5 MB PDF → a row in `School` with ID `XB26-S-001`, members 4–5 blank, and a clickable private letter link. The email arrives if one was given.
- [ ] A 7 MB PDF, or a JPG, is rejected on the phone with a clear message.
- [ ] Guardian "Other" without "specify" → blocked. Invalid NIC (`12345`) → blocked. Both old (`851234567V`) and new (`198512345678`) NICs → accepted.
- [ ] A University team of 5 lands in the `University` tab with all reg nos + years and no file.
- [ ] The same uni registration number in a second team → server error naming the first team's ID.
- [ ] You can't add a 6th member, or submit with only 1 member.
- [ ] Double-tapping Submit and retrying after a forced timeout (DevTools offline) creates **one** row.
- [ ] A POST after `REG_CLOSES` (edit the Script Property to test) → `REG_CLOSED`, and the UI shows the message.
- [ ] A renamed `.exe` → `.pdf` is rejected by the server (`FILE_INVALID`).
- [ ] Honeypot filled → no row, UI still shows fake success.
- [ ] Refreshing mid-form restores the draft (and asks to re-attach the letter).
- [ ] The whole flow works with one thumb on a 360px phone, and the keyboard never covers the active field (`scrollIntoView` on focus).
- [ ] Drive folder sharing = "Restricted". Sheet shared only with committee.

**Prompt for Sonnet — Phase 2**
```
Continue the XBOTIX 2026 website. Read PLAN.md fully (especially D5, E4, E5, E6, E7, E8) and review the existing Phase 1 code before changing anything.

Implement PHASE 2 ONLY: the registration system end-to-end.
Frontend (js/modules/register/*): School/University tabs → wizard exactly per E4 (School 4 steps: School, Members, Guardian & letter, Review; University 3 steps: University, Members, Review); teams of 2–5 members where member 1 is the leader; school members = name + phone; guardian = name, phone, NIC, relation Teacher/Parent/Other(+specify); university members = name, WhatsApp/phone, registration number, registration year; file upload per E8 (PDF only by default, %PDF check, 5 MB limit, preview, base64; image compression path only behind upload.allowImages); localStorage draft autosave (text only); API client per E5 (Content-Type text/plain;charset=utf-8, AbortController timeout, retry reusing the same submissionId, map server field errors back to inputs, honeypot + elapsedMs); success screen with Registration ID, copy button, .ics download, WhatsApp group link. The form renders only in stage "open"; handle the stage changing mid-fill.
Backend (apps-script/Code.gs, paste-ready): setup(), doPost, doGet, json_ helper, server-side validation mirroring the client rules, registration window check from Script Properties, honeypot/min-time spam drop, CacheService rate limit, idempotency by submissionId, cross-team duplicate check (member phone / uni reg no) inside the lock, base64 decode + magic-byte check (PDF; JPEG/PNG only if ALLOW_IMAGES) + 5MB limit, save to the private School letters folder (never change sharing), LockService-protected per-category counter IDs (XB26-S-001 / XB26-U-001), append rows with exact column orders from E6, branded HTML confirmation email via MailApp with quota check, Log tab for errors, testRegisterSchool()/testRegisterUniversity().
Also write apps-script/README-apps-script.md with the E7 deployment steps.
Constraints: vanilla JS, no libraries; client and server validation rules must match; never put Sheet/Drive IDs in frontend code; accessible form (labels, aria-describedby errors, focus management, aria-live status); inputs ≥16px font.
At the end, give me a manual test checklist matching Phase 2 "Done when", and list anything I must configure by hand.
```

---

### PHASE 3 — Polish, "wow" layer, launch & handover (can run while registration is open)

**Scope**
1. **Motion polish:** countdown digit slide, magnetic/glow hover on primary CTAs (fine pointer only), timeline pad "power-on" spark, section eyebrow type-on, hero hex idle float. All disabled under reduced motion.
2. **Optional live features (flags):**
   - `liveCount`: `doGet?action=status` → "124 teams registered" live counter in the hero/register section (social proof) + server clock-skew correction for the countdown.
   - `announcements`: ticker/banner under the hero from the Sheet `Announcements` tab (committee edits the Sheet, no deploy).
   - `turnstile`: Cloudflare Turnstile widget on Review step + server verify via `UrlFetchApp` (enable only if spam appears).
3. **Sponsors honeycomb wall** (for when sponsors arrive): logos inside hexagons, title sponsor in a large center hex, tiers as rings. Grayscale → color on hover/tap/in-view on mobile. A lower-tier marquee on mobile.
4. **Workshop gallery** (for when workshops happen): masonry grid, district chips filter, lightbox (vanilla, swipe support).
5. **Post-event mode** (`ended` stage): hero becomes "XBOTIX 2026 — Thank you", winners grid on top, and registration section replaced by "See you in 2027".
6. **SEO/share:** meta, OG image (build `assets/img/logo/og-image.jpg` 1200×630), favicons, JSON-LD Event, `robots.txt`, `sitemap.xml`, `404.html` in brand style.
7. **Performance & a11y audit:** Lighthouse mobile ≥ 90 across the board, fix issues, image `srcset`, font subsetting, `fetchpriority="high"` on the hero image.
8. **Sheet Dashboard tab** formulas (E6) + an optional daily summary email to ADMIN_EMAIL via a time trigger.
9. **Deploy:** GitHub repo → Netlify/Cloudflare Pages, custom domain, `netlify.toml`/`_headers` with cache headers (long cache for `/assets/img/*`, short for `/data/*`, `/js/config.js` and rulebooks).
10. **Handover docs:** `README.md` covering how to run locally, how to change dates (**both** `config.js` and Script Properties), how to add a sponsor/workshop/winner/rulebook version, how to redeploy Apps Script safely, how to reset for next year (new Sheet, counters, `XB27` prefix).

**Done when**
- [ ] Lighthouse mobile ≥ 90 on all four categories.
- [ ] WhatsApp/Facebook link preview shows the OG image + title.
- [ ] All 5 stages look intentional (screenshot each with `?stage=`).
- [ ] A non-developer committee member can follow README to add a sponsor and update a rulebook.
- [ ] Real-device test: Android Chrome (low-end), iPhone Safari, desktop Chrome/Firefox/Edge.

**Prompt for Sonnet — Phase 3**
```
Continue the XBOTIX 2026 website. Read PLAN.md fully and review the existing code (Phases 1–2 are complete and live — do not break registration).

Implement PHASE 3: polish and launch readiness, per Part F → Phase 3 scope, items 1–10.
Priorities in order: (a) post-event mode + all five stages look intentional, (b) SEO/OG/favicons/JSON-LD/404/robots/sitemap, (c) performance & accessibility audit fixes to reach Lighthouse mobile ≥90, (d) motion polish (reduced-motion safe, fine-pointer-only hover effects), (e) feature-flagged extras: liveCount + clock-skew via doGet?action=status, announcements from the Sheet, Turnstile, (f) sponsors honeycomb wall and workshop gallery renderers with lightbox, (g) Dashboard formulas + optional daily summary trigger in Code.gs, (h) netlify.toml (or _headers) with cache rules, (i) README.md handover guide for non-developers.
Every new Apps Script endpoint must keep the existing doPost behavior unchanged; tell me clearly if a redeploy (Manage deployments → New version) is needed.
Constraints: vanilla, no libraries, JS budget ≤40KB total, no console errors. At the end, list what changed, what needs manual setup, and remaining [CONFIRM] items.
```

---

## PART G — Open questions for the committee (answer before or during Phase 1)

1. Exact dates & times: registration opens, closes, competition day start/end.
2. ~~Team size~~ ✅ 2–5 members, member 1 = leader. Is there a max number of teams per category?
3. Registration fee? If yes, how is it paid? (bank slip upload?)
4. Challenges/sub-categories per category?
5. University eligibility: Sri Lankan universities only? Can a student be in two teams? (The plan currently blocks the same phone/reg no in two teams.)
5a. Keep the optional **Team name** and **Contact email** fields? (Needed for the confirmation email and for scoreboards/certificates.)
5b. Accept only a PDF letter (current), or also a photo of the letter (`allowImages`)?
5c. Allowed university registration-year range (placeholder 2018–2026).
6. Exact wording required on the school verification letter (put a sample template PDF in `assets/rulebooks/`?).
7. One line + a stat for each past edition (2014–2018, 2023, 2025) and the reason for the 2019–2022 gap (or keep "System paused").
8. All 2025 winner posters/photos (high-res) and permission to show them.
9. 2026 theme/tagline, social links, WhatsApp group link, contact person numbers, official email.
10. Domain name, and who owns the committee Google account.
11. Do you want to show **past partners** (from the 2025 poster strip) in the sponsors section until new sponsors confirm? (Needs their permission.)
