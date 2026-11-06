import { JOB_PAY, JOB_TYPE, descriptionHtml } from "./description";
import { priorityByDateAdded } from "./priority";
import { nextReference, planForDate, type JobTitle } from "./schedule";
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
 * One open job per sheet ZIP every day.
 * Tuesday, Wednesday, and Thursday each use one title.
 * Friday through Monday split the three titles across the ZIPs and keep that mix through Monday.
 * A ZIP that leaves the sheet stays closed. A new title gets a new reference number.
 */
export function syncSheetJobs(
  rows: SheetRow[],
  existing: Job[],
  today: string,
  titles: JobTitle[],
): Job[] {
  const places = uniqueZips(rows).sort((a, b) => a.postalcode.localeCompare(b.postalcode));
  const priorities = priorityByDateAdded(places.map((place) => place.date_posted));
  const plan = planForDate(today, titles);
  const jobs: Job[] = existing.map((job) => ({ ...job, status: "closed" }));
  const used = new Set(jobs.map((job) => job.referencenumber));

  places.forEach((place, index) => {
    const title = plan.titleAt(index);
    const prior = jobs.find(
      (job) =>
        job.postalcode === place.postalcode &&
        job.date_posted === plan.date &&
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
      prior.valid_through = plan.validThrough;
      prior.date_added = place.date_posted;
      prior.priority = priorities.get(place.date_posted) ?? 5;
      return;
    }

    const referencenumber = nextReference(place.postalcode, plan.date, title.title_id, used);
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
      date_posted: plan.date,
      date_added: place.date_posted,
      priority: priorities.get(place.date_posted) ?? 5,
      valid_through: plan.validThrough,
    });
  });

  return sortJobs(jobs);
}
