# Hetal Retail job feed

Public job pages and an Indeed Job Sync XML feed for Hetal Retail store audits. Indeed reads `/feed.xml`. A Hetalite who clicks a listing lands on `/jobs/{referencenumber}` and can download the Hetal app.

Edit `data/jobs.json`. The feed and the pages both read that file. Closed jobs stay out of the feed, and their pages return HTTP 410.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123). The feed is [http://127.0.0.1:43123/feed.xml](http://127.0.0.1:43123/feed.xml).

Copy `.env.example` to `.env.local` when you have the real OneLink, contact email, or company name. The app runs without that file and uses the placeholders below.

## Validate the feed

With the dev server running:

```bash
npm run validate-feed
```

The script fetches `/feed.xml` and checks that:

- the XML is well formed and served as `application/xml`
- every required field is present and wrapped in CDATA
- descriptions are HTML, not HTML entities
- reference numbers are unique
- ZIP codes are 5 digits, including leading zeros
- every feed URL returns 200 and the page title matches the listing
- pay, city, state, ZIP, and description on the page match the feed
- the download button keeps the base URL's `pid` and appends `c`, `af_sub1`, and `af_sub2`
- closed jobs are absent from the feed and their pages return 410

Set `VALIDATE_BASE_URL` if the app is not on port 43123. Leave `SITE_URL` unset while validating locally so the feed URLs use the same host.

## jobs.json

One object per visit:

| Field | Notes |
| --- | --- |
| `referencenumber` | Stable id. Indeed uses this to tell listings apart. Do not reuse it. |
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

The three open sample visits are Nashua NH `03060`, Secaucus NJ `07094`, and Hackensack NJ `07601`. Cambridge MA `02139` is closed so the 410 page can be checked. It is not in the feed.

The contact email is a placeholder until Hetal sends the real address. Pay is `$6 - $17 per audit`.

## What a job page does

The page is server rendered. It shows the title, pay, city, state, ZIP, and the same HTML description Indeed receives. One button, **Download the Hetal app**, links to the OneLink:

`{ONELINK_BASE_URL}&c={title_id}&af_sub1={postalcode}&af_sub2={referencenumber}`

The base URL already contains `?af_xp=custom&pid=job-board-xml`, so the visit params are appended with `&` and encoded. The button does not add a second `pid`.

The page also includes JobPosting JSON-LD. There is no apply form and no sign-in. Candidates apply in the app.

A closed job shows "This job is no longer available" and returns 410. An unknown reference number returns 404.

## Feed

`GET /feed.xml` returns `Content-Type: application/xml`. The root is `<source>` with `<publisher>`, `<publisherurl>`, and one `<job>` per open job. Text fields are CDATA. Each job URL includes `source=Indeed`, which is what Indeed's Job Sync guide asks for.

The feed URL host follows the request, unless `SITE_URL` is set.

## Environment

| Variable | Purpose |
| --- | --- |
| `ONELINK_BASE_URL` | Download link base. Default `https://app.hetalretail.com/sfUI?af_xp=custom&pid=job-board-xml`. |
| `FEED_CONTACT_EMAIL` | Email on every job in the feed. Default `jobs@hetalretail.com`. |
| `COMPANY_NAME` | Publisher and company. Default `Hetal Retail`. |
| `SITE_URL` | Optional canonical origin for feed URLs. Leave unset until `jobs.hetalretail.com` answers. |

## Deploy

This is a Next.js app meant for Vercel.

1. Import the project in Vercel and set the three environment variables. Leave `SITE_URL` empty until the custom domain works.
2. Ask the client's DNS admin to CNAME `jobs.hetalretail.com` to the Vercel target (usually `cname.vercel-dns.com`).
3. Add `jobs.hetalretail.com` as a domain on the Vercel project.
4. Set `SITE_URL=https://jobs.hetalretail.com` and redeploy.
5. Send `https://jobs.hetalretail.com/feed.xml` to Andy's Indeed representative. Indeed reads it about every 6 hours.

Until the CNAME exists, use the Vercel preview URL. Fetch `/feed.xml` on that host and confirm the job URLs use the same host.

## Not in this version

No Google Sheet ingest, no daily title rotation, no scheduler, no apply form, no accounts, and no performance reporting. Those are later phases. Brand assets are a type wordmark until Hetal sends a logo.
