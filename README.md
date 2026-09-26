# XBOTIX 2026 — Content Guide

How to run the site locally, and how to add real workshop photos and sponsor logos. Written for a
non-developer committee member — no coding needed, just editing two JSON files and dropping in images.

> **Reference copies:** `examples/sponsors.json` and `examples/workshops.json` hold the sample/test
> entries used while building the site. Keep them — they're handy to copy-paste the shape of an entry from.

---

## Running the site locally

```
npx serve .
```

Then open the URL it prints (usually `http://localhost:3000`). Don't just double-click `index.html` —
the page loads its data over `fetch()`, which browsers block on a plain `file://` path.

---

## PART 1 — Adding a workshop photo

**Where things live**
- Photos: `assets/img/workshops/`
- The list of workshops: `data/workshops.json`
- The on/off switch: `features.workshops` in `js/config.js`

### Step by step

1. **Get the photo ready.**
   - JPG or PNG, any orientation (portrait or landscape both look good — the gallery is a mosaic that
     uses each photo's real shape, not a forced square).
   - Resize to roughly 1200px on the long side and keep it under ~500KB. ([squoosh.app](https://squoosh.app)
     is a free drag-and-drop tool for this if the file is large.)
   - Give it a short, clear filename with no spaces: `mahinda-college-oct2026.jpg`.

2. **Upload the photo file.**
   - On GitHub: open the repo → go into `assets/img/workshops/` → **Add file → Upload files** → drop
     your photo in → commit.
   - Or, if you're working locally, just copy the file into that folder.

3. **Add one entry to `data/workshops.json`.**
   Open the file, find the `items` array, and add a new `{ ... }` block. Every entry looks like this:

   ```json
   {
     "school": "Mahinda College",
     "district": "Galle",
     "date": "2026-10-20",
     "photo": "assets/img/workshops/mahinda-college-oct2026.jpg",
     "caption": "Intro to line-followers"
   }
   ```

   | Field | Required? | Notes |
   |---|---|---|
   | `school` | Yes | Shown as the bold title on the photo. |
   | `district` | No | Shown as extra detail on hover/tap (e.g. "Galle"). |
   | `date` | No | ISO format `YYYY-MM-DD`. Shown as extra detail on hover/tap, formatted nicely. |
   | `photo` | Yes | Path to the file you just uploaded, starting with `assets/img/workshops/`. |
   | `caption` | No | One short line about what happened — shown as extra detail on hover/tap. |

   **Don't forget the comma** between entries. A full file with two workshops looks like:

   ```json
   { "items": [
     { "school": "Mahinda College", "district": "Galle", "date": "2026-10-20",
       "photo": "assets/img/workshops/mahinda-college-oct2026.jpg", "caption": "Intro to line-followers" },
     { "school": "Richmond College", "district": "Galle", "date": "2026-10-27",
       "photo": "assets/img/workshops/richmond-college-oct2026.jpg", "caption": "Building the chassis" }
   ] }
   ```

4. **Delete the sample entries.** The three `[SAMPLE] ...` entries currently in `data/workshops.json`
   are placeholders — remove them once you have real ones (or replace them one at a time as real
   workshops happen).

5. **Turn the gallery on.** In `js/config.js`, find:
   ```js
   features: { sponsors: false, workshops: false, ... }
   ```
   and set `workshops: true`. (If you already turned it on for testing, skip this.)

6. **Commit.** Netlify/Cloudflare redeploys automatically in about a minute.

### What you'll see
- Each photo appears as its own gallery tile showing just the school name. Hovering (on a computer) or
  tapping (on a phone) lifts the tile slightly in 3D and reveals the district, date and caption.
- Photos never disappear — every workshop you add stays in the gallery, building up over the year.
- Once there are 3+ workshops, a "Skip to latest" button appears next to the heading.
- The gallery is a real mosaic — different photo shapes end up different sizes, like a phone's photo
  gallery, not a rigid grid. It uses 1 column on a phone and grows up to 5 columns on a wide screen.

---

## PART 2 — Adding a sponsor logo

**Where things live**
- Logos: `assets/img/sponsors/`
- The list of sponsors: `data/sponsors.json`
- The on/off switch: `features.sponsors` in `js/config.js`

### Step by step

1. **Get the logo ready.**
   - **PNG with a transparent background** is the safest choice — ask the sponsor for one, or export
     one yourself. It gets placed on a white card, so it works whichever colour the logo is.
   - SVG logos also work, but **only if the file has `width` and `height` on its root `<svg>` tag**
     (not just a `viewBox`) — logos exported without them can fail to display. If you're not sure, use
     a PNG instead; it always works.
   - Roughly 400×150px (or similar wide aspect ratio) looks best — very tall/square logos get
     letterboxed inside the card.

2. **Upload the logo file** the same way as a workshop photo, into `assets/img/sponsors/`.

3. **Add one entry to `data/sponsors.json`.**

   ```json
   {
     "name": "Simsyn",
     "logo": "assets/img/sponsors/simsyn.png",
     "tier": "Title",
     "url": "https://simsyn.example.com"
   }
   ```

   | Field | Required? | Notes |
   |---|---|---|
   | `name` | Yes | Shown under the logo. |
   | `logo` | Yes | Path to the file you uploaded. |
   | `tier` | Yes | Must be one of the words listed in `"tiers"` at the top of the same file (`Title`, `Platinum`, `Gold`, `Silver`, `Partner`) — case must match exactly. |
   | `url` | No | The sponsor's website. Leave as `""` if they don't have one — the "Visit site" link just won't show. |

   A full file with two sponsors looks like:

   ```json
   { "tiers": ["Title", "Platinum", "Gold", "Silver", "Partner"], "items": [
     { "name": "Simsyn", "logo": "assets/img/sponsors/simsyn.png", "tier": "Title", "url": "https://simsyn.example.com" },
     { "name": "REF Media", "logo": "assets/img/sponsors/ref-media.png", "tier": "Gold", "url": "" }
   ] }
   ```

4. **Delete the `[SAMPLE] ...` entries** in `data/sponsors.json` once you have real ones.

5. **Turn it on**: set `sponsors: true` in `js/config.js` (in the same `features: {...}` line as above).

6. **Commit.** Redeploys automatically.

### What you'll see
- Sponsors appear one at a time in a "spotlight" — the current one large and centered, the previous
  and next ones peeking in half-size and faded at the edges, so it's obvious there's more to see.
- It cycles automatically every few seconds, or visitors can use the arrows/dots. It's bigger on desktop
  than on mobile.
- Sponsors are shown **in tier order** (Title first, then Platinum, Gold, Silver, Partner) — not the
  order you typed them in the file.

---

## Checking your changes before they go live

1. Run `npx serve .` and open the site locally.
2. Scroll to **School Workshops** / **Partners** and check the new entry looks right.
3. Check it on a phone-width window too (resize your browser narrow, or use your phone).
4. If something looks broken, the most common causes are:
   - A missing comma between two `{ ... }` entries in the JSON file.
   - A `photo`/`logo` path that doesn't exactly match the uploaded filename (check spelling and case).
   - An SVG sponsor logo missing `width`/`height` (switch to PNG — see above).

## Turning a section off again

If you want to go back to the "coming soon" teaser (e.g. before the first real workshop happens), set
its flag back to `false` in `js/config.js` — the JSON data can stay as-is, it just won't be shown.
