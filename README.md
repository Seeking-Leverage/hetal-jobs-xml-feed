# Hetal Retail job feed

Public job pages and job feeds for Hetal Retail store audits. Indeed reads `/feed.xml`, Adzuna reads `/adzuna.xml`, and ZipRecruiter reads `/ziprecruiter.xml`. All three read `data/jobs.json`. A Hetalite who clicks a listing lands on `/jobs/{referencenumber}` and can download the Hetal app.

Closed jobs stay out of every feed, and their pages return HTTP 410.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The feed is [http://127.0.0.1:43123/feed.xml](http://127.0.0.1:43123/feed.xml).

Copy `.env.example` to `.env.local` to override the download link, contact email, or company name. The app runs without that file and uses the defaults below.

## Validate the feed

With the dev server running:

```bash
npm run validate-feed
```

The script checks `/feed.xml`, `/adzuna.xml`, and `/ziprecruiter.xml`. It confirms that:

- each feed is well formed XML and lists every open job
- closed jobs and the sample fixtures are absent
- ZIP codes are 5 digits, including leading zeros, and reference numbers are unique
- every feed URL returns 200 and the title, pay, city, state, ZIP, and description match
- the download button uses that feed's `pid` and appends `c`, `af_sub1`, and `af_sub2`
- a page opened with no channel keeps the Indeed `pid`

Set `VALIDATE_BASE_URL` if the app is not on port 43123. Leave `SITE_URL` unset while validating locally so the feed URLs use the same host.

## jobs.json

One object per visit:

| Field | Notes |
| --- | --- |
| `referencenumber` | `HTL-{ZIP}-{YYYYMMDD}-{title_id}-{NN}`. Example: `HTL-03060-20261109-store-auditor-01`. The date is `date_posted` without hyphens. The title slug is lowercase words separated by hyphens, the same value as `title_id`. `NN` is a two-digit sequence, starting at `01`. Indeed uses this to tell listings apart. Never reuse a reference number. |
| `requisitionid` | Shared id. The same visit in several cities can share one requisition id. |
| `title` | Job title only. Do not put the city, pay, or schedule in the title. |
| `title_id` | Slug sent as the OneLink campaign (`c`). Example: `store-auditor`. |
| `city`, `state`, `country` | `state` is the two-letter abbreviation. `country` is `US`. |
| `postalcode` | Text, not a number, so leading zeros stay. `"03060"` is valid. Shorter digit strings are padded to 5. |
| `pay` | Indeed salary text. The sample is `$6 - $17 per audit`. |
| `jobtype` | `contract` for this gig. `part-time` and `full-time` remain available for a different visit. |
| `description_html` | HTML using `p`, `h2`, `ul`, `li`, `strong`, and `em`. Use real characters, not `&amp;` or `&lt;`. |
| `status` | `open` or `closed`. Only `open` jobs are in the feed. |
| `date_posted` | `YYYY-MM-DD`. This is the date in the feed. Do not use a future date. |

`fixtures/sample-jobs.json` keeps the original sample visits for tests, including the closed Cambridge visit. They are not part of `data/jobs.json`.

## Import the weekly sheet

The live visits come from the Hetal Google Sheet (City, Zip, Metro, Date Added):

[https://docs.google.com/spreadsheets/d/1jRI2rzi_JONSOLvSaBebV54QUV8wJe57tfV74zPcDwM/edit](https://docs.google.com/spreadsheets/d/1jRI2rzi_JONSOLvSaBebV54QUV8wJe57tfV74zPcDwM/edit)

```bash
npm run import-jobs
```

That downloads the published CSV. No Google sign-in is required. To use a local export instead:

```bash
npm run import-jobs -- path/to/jobs.csv
```

`IMPORT_WEEK` defaults to `2026-11-02`. The sheet has 60 rows on that date, one ZIP each, so the import writes 60 open jobs. Metro is stored for reporting and is left out of the pages and feeds. A visit stays open for 7 days from Date Added unless that reference number was already marked closed. Running the import again keeps those reference numbers and does not reuse them.

Pay is `$6 - $17 per audit`. The feed contact email is `marketing@hetalretail.com`.

## Weekly title test

Each ZIP tries three titles in one week. `data/titles.json` is the catalog, in order:

1. Tuesday: On-Demand Store Auditor (`store-auditor`)
2. Wednesday: Retail Merchandiser (`retail-merchandiser`)
3. Thursday: Mystery Shopper (`mystery-shopper`)

Friday, Saturday, and Sunday keep Thursday's title and the same reference number. Monday closes the previous week's job. The new week's Tuesday job is created only when that slot is approved.

```bash
npm run generate-schedule
```

That writes `data/title-schedule.json` from the sheet ZIPs in `data/jobs.json` and the three titles. Every slot starts with `"approved": false`. Andy can edit a title and set `"approved": true`, then run the command again. Approved flags and title edits are kept. Unapproved slots stay out of every feed.

Only the approved job for today can replace the live visit. That publish closes the previous job for the ZIP and leaves it in `data/jobs.json`. Closed pages return 410. A ZIP never has two open jobs. Reference numbers stay `HTL-{ZIP}-{YYYYMMDD}-{title_id}-{NN}` and are never reused. The page title, every feed, and the OneLink `c` value all use that job's title. `af_sub2` is its reference number.

## What a job page does

The page is server rendered. It shows the title, pay, city, state, ZIP, and the same HTML description Indeed receives. One button, **Download the Hetal app**, links to the OneLink:

`{ONELINK_BASE_URL}&c={title_id}&af_sub1={postalcode}&af_sub2={referencenumber}`

The base URL already contains `af_web_dp`, `af_xp=custom`, and a `pid`:

`https://hetalretail.onelink.me/sfUI?af_web_dp=http%3A%2F%2Findeed.hetalretail.com%2F&af_xp=custom&pid=Indeed`

The page replaces `pid` for the channel and appends `c`, `af_sub1`, and `af_sub2`. It does not add `c=indeed_launch` or a second `pid`. With no `channel` query, the button uses `pid=Indeed`. A feed link sets `channel` to `indeed`, `adzuna`, or `ziprecruiter`.

The page also includes JobPosting JSON-LD. There is no apply form and no sign-in. Candidates apply in the app.

A closed job shows "This job is no longer available" and returns 410. An unknown reference number returns 404.

## Feed

Each feed returns `Content-Type: application/xml` and lists only open jobs. Text fields are CDATA. The job URL includes `channel` and `source` for that board.

| Feed | Path | Download `pid` |
| --- | --- | --- |
| Indeed | `/feed.xml` | `Indeed` |
| Adzuna | `/adzuna.xml` | `Adzuna` |
| ZipRecruiter | `/ziprecruiter.xml` | `ZipRecruiter` |

The feed URL host follows the request, unless `SITE_URL` is set. Send each board its own URL, for example `https://jobs.hetalretail.com/feed.xml`.

## Environment

| Variable | Purpose |
| --- | --- |
| `ONELINK_BASE_URL` | Download link base. Default `https://hetalretail.onelink.me/sfUI?af_web_dp=http%3A%2F%2Findeed.hetalretail.com%2F&af_xp=custom&pid=Indeed`. |
| `FEED_CONTACT_EMAIL` | Email on every job in the feed. Default `marketing@hetalretail.com`. |
| `COMPANY_NAME` | Publisher and company. Default `Hetal Retail`. |
| `SITE_URL` | Optional canonical origin for feed URLs. Leave unset until `jobs.hetalretail.com` answers. |
| `JOBS_CSV_URL` | Optional sheet CSV. The default is the published Hetal sheet. |
| `JOBS_CSV_PATH` | Optional local CSV export. Used instead of the URL when set. |
| `IMPORT_WEEK` | Week to import, `YYYY-MM-DD` or `M/D/YY`. Default `2026-11-02`. |

## Deploy

This is a Next.js app meant for Vercel.

1. Import the project in Vercel and set the three environment variables. Leave `SITE_URL` empty until the custom domain works.
2. Ask the client's DNS admin to CNAME `jobs.hetalretail.com` to the Vercel target (usually `cname.vercel-dns.com`).
3. Add `jobs.hetalretail.com` as a domain on the Vercel project.
4. Set `SITE_URL=https://jobs.hetalretail.com` and redeploy.
5. Send each board its feed: `/feed.xml` to Indeed, `/adzuna.xml` to Adzuna, and `/ziprecruiter.xml` to ZipRecruiter.

Until the CNAME exists, use the Vercel preview URL. Fetch `/feed.xml` on that host and confirm the job URLs use the same host.

## Not in this version

No Google sign-in, no unattended publisher, no apply form, no accounts, and no performance reporting. A title goes live only after Andy approves it in `data/title-schedule.json` and runs `npm run generate-schedule`.
