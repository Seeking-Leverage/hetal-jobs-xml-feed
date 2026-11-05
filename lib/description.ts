export const JOB_TITLE = "On-Demand Store Auditor";
export const JOB_TITLE_ID = "store-auditor";
export const JOB_REQUISITION_ID = "REQ-STORE-AUDITOR";
export const JOB_PAY = "$6 - $17 per audit";
export const JOB_TYPE = "contract" as const;

/** A visit stays open on the date added and the next six days. */
export const OPEN_DAYS = 7;

export function openingLine(city: string, state: string, postalcode: string): string {
  return `Flexible in-store audit work near ${city}, ${state} ${postalcode}. Paid per audit, fast onboarding, go when it suits you.`;
}

export function descriptionHtml(city: string, state: string, postalcode: string): string {
  return [
    `<p>${openingLine(city, state, postalcode)}</p>`,
    "<p>Hetal pays you to complete short audits at stores near you, like Walmart, Target, Kroger, Whole Foods and Sprouts. The app shows you which store and which aisles to check. You visit, complete the audit in the app, and get paid.</p>",
    "<h2>Why people like it</h2>",
    "<ul><li>No interview and no set schedule. Pick audits that fit your week.</li><li>Setup takes about 2 minutes</li><li>Your first $10 audit is available as soon as you choose a location</li><li>Stores you already shop at, near home</li><li>No purchases, no customer interaction, no experience needed</li></ul>",
    "<h2>Pay</h2>",
    "<ul><li>$6 to $17 per audit, depending on size</li><li>Paid by direct deposit, typically within a week of completing an audit</li></ul>",
    "<h2>How it works</h2>",
    "<ul><li>New audits release every Monday and are due by Sunday night</li><li>You start with up to 3 audits per week. Complete them reliably and that number grows.</li></ul>",
    "<h2>Good to know</h2>",
    "<ul><li>This is gig work, not employment. No hiring process. Download the app to get started.</li><li>No benefits and no mileage reimbursement. Per-audit pay is your full compensation.</li><li>You need a smartphone.</li></ul>",
    "<p>People with a criminal record are encouraged to apply.</p>",
  ].join("\n");
}
