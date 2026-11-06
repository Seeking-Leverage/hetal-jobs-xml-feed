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
- the download button uses that feed's `pid`, keeps `c=xml-feed-hetal-website`, and adds `af_adset`, `af_sub1`, and `af_sub2`
- a page opened with no channel keeps `pid=xml-hetal`

Set `VALIDATE_BASE_URL` if the app is not on port 43123. Leave `SITE_URL` unset while validating locally so the feed URLs use the same host.

## jobs.json

One object per visit:

| Field | Notes |
| --- | --- |
| `referencenumber` | `HTL-{ZIP}-{YYYYMMDD}-{title_id}-{NN}`. Example: `HTL-03060-20261109-store-auditor-01`. The date is `date_posted` without hyphens. The title slug is lowercase words separated by hyphens, the same value as `title_id`. `NN` is a two-digit sequence, starting at `01`. Indeed uses this to tell listings apart. Never reuse a reference number. |
| `requisitionid` | Shared id. The same visit in several cities can share one requisition id. |
| `title` | Job title only. Do not put the city, pay, or schedule in the title. |
| `title_id` | Slug sent as the OneLink ad set (`af_adset`). Example: `store-auditor`. |
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

Only the approved job for today can replace the live visit. That publish closes the previous job for the ZIP and leaves it in `data/jobs.json`. Closed pages return 410. A ZIP never has two open jobs. Reference numbers stay `HTL-{ZIP}-{YYYYMMDD}-{title_id}-{NN}` and are never reused. The page title, every feed, and the OneLink `af_adset` value all use that job's title. `af_sub2` is its reference number. `c` stays `xml-feed-hetal-website`.

## What a job page does

The page is server rendered. It shows the title, pay, city, state, ZIP, and the same HTML description Indeed receives. One button, **Download the Hetal app**, links to the OneLink. With no board on the request, the button starts from this base and then adds `af_adset`, `af_sub1`, and `af_sub2`:

`https://hetalretail.onelink.me/sfUI?af_xp=custom&pid=xml-hetal&c=xml-feed-hetal-website&af_web_dp=https%3A%2F%2Fwww.hetalretail.com%2Fbecome-a-hetalite`

`af_xp=custom`, `c=xml-feed-hetal-website`, and `af_web_dp=https://www.hetalretail.com/become-a-hetalite` stay as written. The title goes in `af_adset`, the ZIP in `af_sub1`, and the reference number in `af_sub2`. The page does not add `c={title_id}`, `c=indeed_launch`, or a second `c` or `pid`.

A page with no `channel` or `source` keeps `pid=xml-hetal`. A feed link sets both, for example `?channel=adzuna&source=Adzuna`, and the button replaces `pid` with that board name. Known channels use Indeed, Adzuna, and ZipRecruiter. Any other safe short slug or name from the query is used as the `pid`. An unsafe value is ignored and the base `pid` stays. Set the same `ONELINK_BASE_URL` in Vercel and Webflow.

The page also includes JobPosting JSON-LD for Google for Jobs. There is no apply form and no sign-in. Candidates apply in the app.

The canonical URL is `/jobs/{referencenumber}` with no `channel` or `source` query. A feed link may add those parameters, and the page still points Google at the permanent URL. `/sitemap.xml` lists the home page and the open jobs only.

A closed job shows "This job is no longer available", returns 410, and does not include JobPosting markup. An unknown reference number returns 404.

## Google for Jobs

Google requires `datePosted`, `description`, `hiringOrganization`, `jobLocation.address.addressCountry`, and `title`. Each one matches the visible page: the title, the full HTML description, Hetal Retail, the city, state, ZIP, and country, and the posted date. A visit with `valid_through` also sends `validThrough` as the end of that day in America/New_York, and the page says "Open through" that date. `directApply` is false because the button leaves this site. Pay stays `$6 - $17 per audit` on the page and in the XML feeds. It is not copied into `baseSalary`, because Google only accepts `HOUR`, `DAY`, `WEEK`, `MONTH`, and `YEAR`.

```bash
npm run validate-structured-data
```

With the dev server running, that checks the JSON-LD, the canonical URL, the visible text, and `/sitemap.xml`.

Manual checks, after the public host is live:

1. Open [Google's Rich Results Test](https://search.google.com/test/rich-results) and enter one canonical job URL, such as `https://jobs.hetalretail.com/jobs/HTL-03060-20261102-store-auditor-01`. Confirm the detected type is JobPosting and the required properties match the page.
2. In Search Console, use URL Inspection on that same URL. The inspected URL must be the permanent `/jobs/{referencenumber}` address, not a feed URL with `channel`.
3. Inspect a closed job URL and confirm Google sees HTTP 410 and no JobPosting.

To tell Google when a job is published, updated, or closed:

```bash
npm run notify-google -- --dry-run
npm run notify-google
```

The first run lists every open job as published. Later runs send `URL_UPDATED` when the page content changes and `URL_DELETED` when a previously sent job is closed or removed. `URL_DELETED` is sent only after the page returns 410. One visit can be sent on its own:

```bash
npm run notify-google -- --reference HTL-03060-20261102-store-auditor-01 --action published
```

`SITE_URL` must be the public `https` origin. Set `GOOGLE_INDEXING_CLIENT_EMAIL` and `GOOGLE_INDEXING_PRIVATE_KEY` in `.env.local`. Enable the Indexing API on the Google Cloud project, and add the service account as an owner of the Search Console property. Do not commit the key. The default quota is 200 publish requests a day.

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
| `ONELINK_BASE_URL` | Download link base. Default `https://hetalretail.onelink.me/sfUI?af_xp=custom&pid=xml-hetal&c=xml-feed-hetal-website&af_web_dp=https%3A%2F%2Fwww.hetalretail.com%2Fbecome-a-hetalite`. |
| `FEED_CONTACT_EMAIL` | Email on every job in the feed. Default `marketing@hetalretail.com`. |
| `COMPANY_NAME` | Publisher and company. Default `Hetal Retail`. |
| `SITE_URL` | Optional canonical origin for feed URLs. Leave unset until `jobs.hetalretail.com` answers. |
| `JOBS_CSV_URL` | Optional sheet CSV. The default is the published Hetal sheet. |
| `JOBS_CSV_PATH` | Optional local CSV export. Used instead of the URL when set. |
| `IMPORT_WEEK` | Week to import, `YYYY-MM-DD` or `M/D/YY`. Default `2026-11-02`. |
| `GOOGLE_INDEXING_CLIENT_EMAIL` | Service account that owns the Search Console property. Used only by `npm run notify-google`. |
| `GOOGLE_INDEXING_PRIVATE_KEY` | PEM private key for that service account. Store it in `.env.local`. |

## Deploy

This is a Next.js app meant for Vercel.

1. Import the project in Vercel and set the three environment variables. Leave `SITE_URL` empty until the custom domain works.
2. Ask the client's DNS admin to CNAME `jobs.hetalretail.com` to the Vercel target (usually `cname.vercel-dns.com`).
3. Add `jobs.hetalretail.com` as a domain on the Vercel project.
4. Set `SITE_URL=https://jobs.hetalretail.com` and redeploy.
5. Send each board its feed: `/feed.xml` to Indeed, `/adzuna.xml` to Adzuna, and `/ziprecruiter.xml` to ZipRecruiter.

Until the CNAME exists, use the Vercel preview URL. Fetch `/feed.xml` on that host and confirm the job URLs use the same host.

## Not in this version

No Google user sign-in, no unattended publisher, no apply form, no accounts, and no performance reporting. `npm run notify-google` uses a service account when you choose to run it. A title goes live only after Andy approves it in `data/title-schedule.json` and runs `npm run generate-schedule`.
