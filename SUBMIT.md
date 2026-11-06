# Submit the Hetal feed to Indeed

Live feed URL, once `SITE_URL` is the public origin:

`https://jobs.hetalretail.com/feed.xml`

Until `jobs.hetalretail.com` is attached, leave `SITE_URL` empty and give each board the Vercel origin plus its feed path. Every feed lists only the jobs with `status` `open` in `data/jobs.json`.

- Indeed: `{SITE_URL}/feed.xml`
- Adzuna: `{SITE_URL}/adzuna.xml`
- ZipRecruiter: `{SITE_URL}/ziprecruiter.xml`

`FEED_CONTACT_EMAIL` is the `<email>` inside every job. The default is `marketing@hetalretail.com`. Use that address on the Indeed employer account.

The download button starts from this OneLink. It keeps `c=xml-feed-hetal-website`, `af_xp=custom`, and the become-a-hetalite `af_web_dp`. A click from the Indeed feed sets `pid=Indeed`. A page with no board keeps `pid=xml-hetal`. The title is `af_adset`, the ZIP is `af_sub1`, and the reference number is `af_sub2`.

`https://hetalretail.onelink.me/sfUI?af_xp=custom&pid=xml-hetal&c=xml-feed-hetal-website&af_web_dp=https%3A%2F%2Fwww.hetalretail.com%2Fbecome-a-hetalite`

Do not add `c=indeed_launch` or `c={title_id}`, and do not add a second `pid`. ZIP codes stay 5-digit text.

Each `referencenumber` is `HTL-{ZIP}-{YYYYMMDD}-{title_id}-{NN}`, for example `HTL-03060-20261109-store-auditor-01`. The title slug is lowercase words separated by hyphens, and `NN` is a two-digit sequence. `af_sub2` and `/jobs/{referencenumber}` use that same id. Never reuse a reference number.

## Checklist

1. Deploy with `SITE_URL` set to the origin Indeed can fetch, and `FEED_CONTACT_EMAIL` set to `marketing@hetalretail.com`.
2. Open `/feed.xml` on that origin. The response `Content-Type` is `application/xml`, and the body lists the open visits only.
3. Run `VALIDATE_BASE_URL=https://that-origin npm run validate-feed`. It must pass before you send the URL.
4. Open the Indeed employer contact form: [https://www.indeed.com/hire/contact-us](https://www.indeed.com/hire/contact-us).
5. Send this:
   - Company: Hetal Retail
   - Website: the `SITE_URL` origin
   - XML feed URL: `{SITE_URL}/feed.xml` for Indeed, `{SITE_URL}/adzuna.xml` for Adzuna, or `{SITE_URL}/ziprecruiter.xml` for ZipRecruiter
   - Contact email: `marketing@hetalretail.com`
   - Ask Indeed to crawl the Job Sync XML feed and add the open jobs to the employer account.
6. Keep at least 3 open jobs in the feed. Indeed does not process a smaller feed.
7. After Indeed confirms, open one listing and check the title, pay, city, state, and ZIP against `/jobs/{referencenumber}`.
