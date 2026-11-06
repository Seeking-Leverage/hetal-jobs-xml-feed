import { JOB_PAY, JOB_TYPE, descriptionHtml } from "./description";
import { nextReference, titleForDate, type JobTitle } from "./schedule";
import { uniqueZips, type SheetRow } from "./sheet";
import type { Job } from "./types";

function sortJobs(jobs: Job[]): Job[] {
  return jobs.sort((a, b) =>
    `${a.state}${a.city}${a.postalcode}${a.referencenumber}`.localeCompare(
      `${b.state}${b.city}${b.postalcode}${b.referencenumber}`,
    ),
  );
}

/**
 * One open job per sheet ZIP on Tuesday, Wednesday, and Thursday.
 * Friday through Monday close every job. A ZIP that leaves the sheet stays closed.
 * A new title or a new day gets a new reference number.
 */
export function syncSheetJobs(
  rows: SheetRow[],
  existing: Job[],
  today: string,
  titles: JobTitle[],
): Job[] {
  const places = uniqueZips(rows);
  const title = titleForDate(today, titles);
  const jobs: Job[] = existing.map((job) => ({ ...job, status: "closed" }));
  const used = new Set(jobs.map((job) => job.referencenumber));

  if (!title) return sortJobs(jobs);

  for (const place of places) {
    const prior = jobs.find(
      (job) =>
        job.postalcode === place.postalcode &&
        job.date_posted === today &&
        job.title_id === title.title_id,
    );
    if (prior) {
      prior.status = "open";
      prior.title = title.title;
      prior.title_id = title.title_id;
      prior.city = place.city;
      prior.state = place.state;
      prior.country = "US";
      prior.metro = place.metro;
      prior.pay = JOB_PAY;
      prior.jobtype = JOB_TYPE;
      prior.requisitionid = `REQ-${title.title_id.toUpperCase()}`;
      prior.description_html = descriptionHtml(place.city, place.state, place.postalcode);
      prior.valid_through = today;
      continue;
    }

    const referencenumber = nextReference(place.postalcode, today, title.title_id, used);
    used.add(referencenumber);
    jobs.push({
      referencenumber,
      requisitionid: `REQ-${title.title_id.toUpperCase()}`,
      title: title.title,
      title_id: title.title_id,
      city: place.city,
      state: place.state,
      country: "US",
      postalcode: place.postalcode,
      metro: place.metro,
      pay: JOB_PAY,
      jobtype: JOB_TYPE,
      description_html: descriptionHtml(place.city, place.state, place.postalcode),
      status: "open",
      date_posted: today,
      valid_through: today,
    });
  }

  return sortJobs(jobs);
}
