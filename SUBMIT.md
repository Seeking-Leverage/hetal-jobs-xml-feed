# Submit the Hetal feed to Indeed

Live feed URL, once `SITE_URL` is the public origin:

`https://jobs.hetalretail.com/feed.xml`

Until `jobs.hetalretail.com` is attached, leave `SITE_URL` empty and give Indeed the Vercel origin with `/feed.xml` on the end. The feed lists only the jobs with `status` `open` in `data/jobs.json`.

`FEED_CONTACT_EMAIL` is the `<email>` inside every job. The default is `marketing@hetalretail.com`. Use that address on the Indeed employer account.

The download button uses this OneLink and appends only `&c={title_id}&af_sub1={postalcode}&af_sub2={referencenumber}`:

`https://hetalretail.onelink.me/sfUI?af_web_dp=http%3A%2F%2Findeed.hetalretail.com%2F&af_xp=custom&pid=Indeed`

Do not add `c=indeed_launch` to that base URL, and do not add a second `pid`. ZIP codes stay 5-digit text.

Each `referencenumber` is `HTL-{ZIP}-{YYYYMMDD}-{title_id}`, for example `HTL-03060-20261109-store-auditor`. The title slug is lowercase words separated by hyphens. `af_sub2` and `/jobs/{referencenumber}` use that same id. Once Indeed has seen a reference number, keep it on that job. Never reuse it for another title, date, or job.

## Checklist

1. Deploy with `SITE_URL` set to the origin Indeed can fetch, and `FEED_CONTACT_EMAIL` set to `marketing@hetalretail.com`.
2. Open `/feed.xml` on that origin. The response `Content-Type` is `application/xml`, and the body lists the open visits only.
3. Run `VALIDATE_BASE_URL=https://that-origin npm run validate-feed`. It must pass before you send the URL.
4. Open the Indeed employer contact form: [https://www.indeed.com/hire/contact-us](https://www.indeed.com/hire/contact-us).
5. Send this:
   - Company: Hetal Retail
   - Website: the `SITE_URL` origin
   - XML feed URL: `{SITE_URL}/feed.xml`
   - Contact email: `marketing@hetalretail.com`
   - Ask Indeed to crawl the Job Sync XML feed and add the open jobs to the employer account.
6. Keep at least 3 open jobs in the feed. Indeed does not process a smaller feed.
7. After Indeed confirms, open one listing and check the title, pay, city, state, and ZIP against `/jobs/{referencenumber}`.
