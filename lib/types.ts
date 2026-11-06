export const JOB_TYPES = ["part-time", "full-time", "contract"] as const;
export const JOB_STATUSES = ["open", "closed"] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  referencenumber: string;
  requisitionid: string;
  title: string;
  title_id: string;
  city: string;
  state: string;
  country: string;
  postalcode: string;
  /** Reporting only. Not shown on the page or in a feed. */
  metro?: string;
  pay: string;
  jobtype: JobType;
  description_html: string;
  status: JobStatus;
  date_posted: string;
  /** Last day the visit stays open, inclusive. Title days expire the same day. */
  valid_through?: string;
};
