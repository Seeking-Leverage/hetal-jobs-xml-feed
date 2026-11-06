# Submit the Hetal feed to Indeed

Live feed URL:

`https://www.hetalretail.com/jobs/feed.xml`

Every feed lists only the jobs with `status` `open` in `data/jobs.json`.

- Indeed: `https://www.hetalretail.com/jobs/feed.xml`
- Adzuna: `https://www.hetalretail.com/jobs/adzuna.xml`
- ZipRecruiter: `https://www.hetalretail.com/jobs/ziprecruiter.xml`

`FEED_CONTACT_EMAIL` is the `<email>` inside every job. The default is `marketing@hetalretail.com`. Use that address on the Indeed employer account.

The download button starts from this OneLink. It keeps `c=xml-feed-hetal-website`, `af_xp=custom`, and the become-a-hetalite `af_web_dp`. Feed URLs do not include `channel` or `source`, so a click from the feed keeps `pid=xml-hetal`. A board that appends `?channel=adzuna&source=Adzuna` gets `pid=Adzuna`. The title is `af_adset`, the ZIP is `af_sub1`, and the reference number is `af_sub2`. Set `ONELINK_BASE_URL` in Webflow to the full URL below. An older Indeed value in that setting overrides the default until it is replaced.

`https://hetalretail.onelink.me/sfUI?af_xp=custom&pid=xml-hetal&c=xml-feed-hetal-website&af_web_dp=https%3A%2F%2Fwww.hetalretail.com%2Fbecome-a-hetalite`

Do not add `c=indeed_launch` or `c={title_id}`, and do not add a second `pid`. ZIP codes stay 5-digit text.

Each `referencenumber` is `HTL-{ZIP}-{YYYYMMDD}-{title_id}-{NN}`, for example `HTL-03060-20261109-store-auditor-01`. The title slug is lowercase words separated by hyphens, and `NN` is a two-digit sequence. `af_sub2` and `/jobs/{referencenumber}` use that same id. Never reuse a reference number.

## Checklist

1. Deploy with `SITE_URL` set to `https://www.hetalretail.com`, and `FEED_CONTACT_EMAIL` set to `marketing@hetalretail.com`.
2. Open `/jobs/feed.xml` on that origin. The response `Content-Type` is `application/xml`, and the body lists the open visits only.
3. Run `VALIDATE_BASE_URL=https://that-origin npm run validate-feed`. It must pass before you send the URL.
4. Open the Indeed employer contact form: [https://www.indeed.com/hire/contact-us](https://www.indeed.com/hire/contact-us).
5. Send this:
   - Company: Hetal Retail
   - Website: the `SITE_URL` origin
   - XML feed URL: `https://www.hetalretail.com/jobs/feed.xml` for Indeed, `https://www.hetalretail.com/jobs/adzuna.xml` for Adzuna, or `https://www.hetalretail.com/jobs/ziprecruiter.xml` for ZipRecruiter
   - Contact email: `marketing@hetalretail.com`
   - Ask Indeed to crawl the Job Sync XML feed and add the open jobs to the employer account.
6. Keep at least 3 open jobs in the feed. Indeed does not process a smaller feed.
7. After Indeed confirms, open one listing and check the title, pay, city, state, and ZIP against `/jobs/{referencenumber}`.
