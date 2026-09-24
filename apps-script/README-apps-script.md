# XBOTIX 2026 — Registration backend (Google Apps Script)

`Code.gs` is the whole backend. It runs on Google's servers for free, saves every registration to a Google Sheet,
stores the principal's letters in a **private** Drive folder, and emails a confirmation.
The website talks to it through one URL (the "web app" URL).

> **Use a dedicated committee Google account** (not anyone's personal account) to own the Sheet, the script and the Drive folder,
> so ownership can be handed to next year's committee.

## 1. First-time setup (once)

1. Sign in to the **committee Google account**.
2. Create a Google Sheet named **XBOTIX 2026 Registrations**.
3. In the Sheet: **Extensions → Apps Script**. Delete the sample code, paste the whole of `Code.gs`, and save.
4. Choose the function **`setup`** in the toolbar and press **Run**. Accept the permission prompts
   (Sheets, Drive, Gmail). It is safe to run `setup` again; it never deletes registrations.
   - It creates the tabs **School**, **University**, **Dashboard**, **Log**, with headers, a `Status` dropdown
     (Pending / Verified / Rejected / Waitlist) and colours.
   - It creates the Drive folders **XBOTIX 2026 / School letters** (private) and stores their IDs in Script Properties.
5. Open **Project Settings (gear icon) → Script Properties** and set:

   | Property | Value |
   |---|---|
   | `REG_OPENS` | when registration opens, e.g. `2026-10-15T00:00:00+05:30` |
   | `REG_CLOSES` | when it closes, e.g. `2026-11-30T23:59:59+05:30` |
   | `SITE_URL` | your website address, no trailing slash (used for the logo and rulebook link in emails) |
   | `WHATSAPP_GROUP` | (optional) WhatsApp group link for the email |
   | `ADMIN_EMAIL` | (optional) reply-to address on confirmation emails |
   | `ALLOW_IMAGES` | keep `false` (PDF only). `true` also accepts JPG/PNG. Must match `upload.allowImages` in `js/config.js` |
   | `UNI_REG_YEAR_MIN` / `UNI_REG_YEAR_MAX` | (optional) allowed university registration years. Defaults 2018 / 2026. Must match `uniRegYears` in `js/config.js` |

   **`REG_OPENS` / `REG_CLOSES` must equal the dates in `js/config.js`.** The server checks *its own* copy;
   the website only uses its copy to decide what to show.
   `SHEET_ID`, `ROOT_FOLDER_ID`, `SCHOOL_FOLDER_ID`, `COUNTER_S`, `COUNTER_U` are managed by the script; don't edit them.

## 2. Test before going live

Run these from the editor (function drop-down → Run) and read **Execution log**:

- **`testRegisterSchool`** — expect `{"ok":true,"registrationId":"XB26-S-001",...}`, a new row in **School**, and a file in *School letters*.
- **`testRegisterUniversity`** — expect `XB26-U-001` and a row in **University**.

These skip the date window. **Then delete the test rows** (select the rows, right-click → *Delete rows*), and set the counters back so real
teams start at 001: *Script Properties → `COUNTER_S` and `COUNTER_U` → `0`*. Trash the test file in Drive too.

## 3. Deploy as a web app

1. **Deploy → New deployment → ⚙ Select type → Web app**.
2. **Execute as: Me** · **Who has access: Anyone**. Press **Deploy**.
3. Copy the **Web app URL** (ends in `/exec`) into `js/config.js` → `api.url`.
4. Open that URL in a browser. You should see `{"ok":true,"service":"xbotix"}`.

### ⚠ Changing the code later — do NOT make a "New deployment"

A new deployment creates a **new URL** and the live website stops working.
To publish code changes: **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy.** The URL stays the same.
Changing a **Script Property** (for example the closing date) takes effect immediately, with no redeploy.

## 4. Privacy checklist (school students are minors)

- [ ] Drive folder **XBOTIX 2026 / School letters** → *Share* shows **Restricted** (only the committee account).
- [ ] The Sheet is shared **only** with committee emails (2–3 Editors, others Viewer). Never "Anyone with the link".
- [ ] Only committee members can open the letter links in the `Letter` column.

## 5. Running the registration

- Find a team quickly: **Ctrl+F** the Registration ID (e.g. `XB26-S-042`).
- Click **Open letter**, check it, then set **Status** to `Verified` (or `Rejected` / `Waitlist`).
- A team marked **Rejected** no longer blocks its members' phone numbers / registration numbers, so they can register again.
- Excel export: **File → Download → Microsoft Excel (.xlsx)**.
- **Log** tab: server-side errors (never file contents). Check it if a team reports a problem.
- **Dashboard** tab: totals per category and status, and school teams per district.

## What the server enforces (even if someone bypasses the website)

- Registration window (server clock, from `REG_OPENS` / `REG_CLOSES`) → `REG_NOT_OPEN` / `REG_CLOSED`.
- All the same validation as the form (2–5 members, phone, NIC, reg no/year, guardian, consent).
- The letter is a real PDF ≤ 5 MB (checked by its first bytes, not its file name) → `FILE_INVALID`.
- One ID per team, even when two teams submit in the same second (`LockService`): `XB26-S-###` / `XB26-U-###`.
- The same submission sent twice (bad mobile data + retry) returns the same ID and creates **one** row.
- The same member phone number (or university registration number) in two teams is refused, naming the first team's ID.
- Spam: filled hidden field or a form "completed" in under 8 seconds is silently dropped; max 3 attempts per leader phone per 10 minutes.

## Known limits

- A normal Gmail account can send about **100 emails/day** (Google Workspace ≈ 1,500). Past that, registrations still succeed
  and the ID is shown on screen; only the email is skipped and the `Email Sent` column shows `N`.
- The first request after a quiet period can take 3–8 seconds (cold start). The site waits up to 60 seconds.
- Duplicate-submission memory uses a 6-hour cache; after that the Sheet's `Submission ID` column is still checked.

## Next year

Copy the Sheet, change `PREFIX: 'XB26'` in `Code.gs` (e.g. `XB27`), reset `COUNTER_S`/`COUNTER_U` to `0`, run `setup()`, update the dates, and deploy.
