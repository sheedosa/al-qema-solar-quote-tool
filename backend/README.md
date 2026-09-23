# Backend: one Google Sheet

Everything the quote tool stores lives in a single Google Sheet owned by Al Qema:

| Tab | What it holds | Who edits it |
|---|---|---|
| **Leads** | One row per customer submission, newest at the bottom. Arabic values, headers in Arabic and English. The last two columns, **Status** (a dropdown) and **Team notes**, are for the team. | The team: Status and Team notes only |
| **LeadData** | Hidden. The full form and result behind each lead, for the admin panel's detail view. | Nobody by hand |
| **Pricing** | Every published pricing version; exactly one is active. Written by the admin panel's Pricing page. | Nobody by hand |
| **Staff** | The Google email addresses allowed into the admin panel. | The sheet's owner |
| **Log** | Rejected requests and errors, for diagnosis. | Nobody |

An Apps Script attached to the sheet ([`google-apps-script/Code.gs`](google-apps-script/Code.gs))
is the only server. The website sends each submission to it, reads the active prices from it,
and the admin panel signs staff in and publishes prices through it. Download the whole sheet
as an Excel file at any time: **File → Download → Microsoft Excel (.xlsx)**.

## Setup (about 20 minutes, once)

Use the Google account that should **own** the data, ideally a company account rather than a
personal one. Whoever owns the sheet owns the leads.

### 1. Create the sheet and add the script

1. Go to [sheets.google.com](https://sheets.google.com) and create a blank spreadsheet. Name
   it, for example, **Al Qema — Quotes**.
2. **Extensions → Apps Script.** A code editor opens.
3. Delete everything in `Code.gs`, then paste the whole of
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Press **Save**.
4. **Project Settings** (the gear) → tick **Show "appsscript.json" manifest file in editor**.
   Back in the **Editor**, open `appsscript.json`, replace its contents with
   [`google-apps-script/appsscript.json`](google-apps-script/appsscript.json), and save.

### 2. Run `setup` once

1. In the toolbar, choose the function **setup** and press **Run**.
2. Google asks for permission. Choose your account → **Advanced** → **Go to (project name)** →
   **Allow**. The warning appears because the script is your own and unpublished; it only
   gets access to this one spreadsheet and to Google's sign-in check.
3. Back in the sheet, the five tabs now exist. **Leads** is right-to-left with its Status
   dropdown; **LeadData** is hidden.

Running `setup` again later is safe: it only adds what is missing.

### 3. Add the staff

In the **Staff** tab, put each person's Google email in column A, one per row, under the
header. Only these accounts can open the admin panel. Removing a row locks that person out
immediately, even if they are signed in.

A staff member with a Microsoft work address can still sign in: they create a free Google
account using that same email at [accounts.google.com/signup](https://accounts.google.com/signup)
(choose **Use my current email address instead**).

### 4. Create the Google sign-in client

1. Open [console.cloud.google.com](https://console.cloud.google.com) with the same account and
   create a project, for example **Al Qema Admin**.
2. **APIs & Services → OAuth consent screen**: choose **External**, set the app name
   (*Al Qema Admin*) and support email, save. Under **Audience**, press **Publish app** so any
   Google account on the Staff tab can sign in. Only basic sign-in is requested, so no Google
   review is needed.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorised JavaScript origins: `https://sheedosa.github.io` and `http://localhost:5173`.
   - Create, then copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
4. Back in Apps Script: **Project Settings → Script properties → Add script property**:
   name `GOOGLE_CLIENT_ID`, value the client ID. Save.

The Client ID is public by design; there is no client secret in this setup.

### 5. Deploy the web app

1. Apps Script → **Deploy → New deployment** → the gear → **Web app**.
2. Description: `v1`. **Execute as: Me**. **Who has access: Anyone**.
3. **Deploy**, and copy the **Web app URL** (it ends in `/exec`).

"Anyone" means anyone can *call* it, as any website form can be submitted. The script itself
only accepts well-formed submissions, and every other action needs a signed-in staff member.

### 6. Send back three values

All three are public and safe to share:

- the **Web app URL**,
- the **Client ID**,
- the **sheet's link** (from the browser's address bar).

They go into [`src/config.ts`](../src/config.ts) as `SHEETS_API_URL`, `GOOGLE_CLIENT_ID` and
`SHEET_URL`, and the site is redeployed.

### 7. First sign-in

Open the admin panel, sign in with Google, open **Pricing** and press **Publish the built-in
prices**. That writes the first version into the Pricing tab. From then on, every price
change is published from that page.

## Changing the script later

Paste the new `Code.gs`, save, then **Deploy → Manage deployments → the pencil → Version: New
version → Deploy**. The URL stays the same. A *new deployment* would create a new URL, which
the site would need to be told about.

## How it protects the data

- **Submissions** are checked on arrival: every field's type and length, a Libyan mobile
  number, and a 64 KB size cap. A repeated submission id is ignored, so the site's automatic
  retries never create a duplicate row. At most 120 submissions are accepted per 10 minutes.
- **Formulas cannot be injected.** Anything a customer types that starts with `=`, `+`, `-`
  or `@` is stored as plain text.
- **Staff access** is Google sign-in. The script checks the Google token with Google, checks
  it was issued for this app, and checks the email is on the Staff tab. It then issues its own
  12-hour session, re-checking the Staff tab on every action.
- **Pricing** versions are numbered and made live in one locked step, so two people
  publishing at once cannot clash. The site only accepts a published config that passes the
  same checks as the admin panel; anything else falls back to the last good copy.
- **Tabs other than Leads are protected** so only the owner can edit them.

## Limits worth knowing

- Apps Script can take one to three seconds to wake up. A first-time visitor waits up to
  six seconds for the prices before the site falls back to its built-in ones.
- A free Google account allows 90 minutes of script run time a day, roughly several thousand
  visits and submissions. A Google Workspace account allows six hours.
- Customer photos are not stored, as before.

## Tests

`npm test` runs `Code.gs` itself inside a sandbox with in-memory stand-ins for the Google
services: submissions, duplicates, the formula guard, the limits, publishing and rollback,
and every sign-in path. See `src/backend/appsScript.test.ts`.
