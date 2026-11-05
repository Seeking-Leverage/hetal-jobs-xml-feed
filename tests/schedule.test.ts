import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

import titlesFile from "../data/titles.json";
import { descriptionHtml } from "../lib/description";
import { buildAdzunaFeedXml, buildFeedXml, buildZipRecruiterFeedXml } from "../lib/feed";
import { loadJobs } from "../lib/jobs";
import { buildOnelink } from "../lib/onelink";
import {
  applySchedule,
  generateSchedule,
  livePlan,
  parseTitles,
  weekdayName,
  type ScheduledJob,
  type TitleSchedule,
} from "../lib/schedule";
import type { Job } from "../lib/types";

const titles = parseTitles(titlesFile);

function visit(overrides: Partial<Job> = {}): Job {
  const postalcode = overrides.postalcode ?? "03060";
  const city = overrides.city ?? "Nashua";
  const state = overrides.state ?? "NH";
  const date = overrides.date_posted ?? "2026-11-02";
  return {
    referencenumber:
      overrides.referencenumber ??
      `HTL-${postalcode}-${date.replaceAll("-", "")}-store-auditor-01`,
    requisitionid: "REQ-STORE-AUDITOR",
    title: "On-Demand Store Auditor",
    title_id: "store-auditor",
    city,
    state,
    country: "US",
    postalcode,
    metro: "Boston, MA",
    pay: "$6 - $17 per audit",
    jobtype: "contract",
    description_html: descriptionHtml(city, state, postalcode),
    status: "open",
    date_posted: date,
    valid_through: "2026-11-08",
    ...overrides,
  };
}

function approve(schedule: TitleSchedule, dates?: string[]): TitleSchedule {
  return {
    ...schedule,
    slots: schedule.slots.map((slot) => ({
      ...slot,
      approved: dates ? dates.includes(slot.date) : true,
    })),
  };
}

function openFor(jobs: Job[], postalcode: string): Job[] {
  return jobs.filter((job) => job.status === "open" && job.postalcode === postalcode);
}

function slot(schedule: TitleSchedule, postalcode: string, date: string): ScheduledJob {
  const found = schedule.slots.find((item) => item.postalcode === postalcode && item.date === date);
  assert.ok(found, `${postalcode} ${date}`);
  return found;
}

describe("weekly title plan", () => {
  it("names Tuesday, Wednesday, and Thursday, and keeps Thursday through Sunday", () => {
    assert.deepEqual(
      titles.map((title) => title.title_id),
      ["store-auditor", "retail-merchandiser", "mystery-shopper"],
    );
    assert.equal(weekdayName("2026-11-03"), "Tuesday");
    assert.equal(livePlan("2026-11-03").liveDate, "2026-11-03");
    assert.equal(livePlan("2026-11-03").titleIndex, 0);
    assert.equal(livePlan("2026-11-04").liveDate, "2026-11-04");
    assert.equal(livePlan("2026-11-04").titleIndex, 1);
    const thursday = livePlan("2026-11-05");
    assert.equal(thursday.liveDate, "2026-11-05");
    assert.equal(thursday.titleIndex, 2);
    for (const day of ["2026-11-06", "2026-11-07", "2026-11-08"]) {
      const plan = livePlan(day);
      assert.equal(plan.liveDate, "2026-11-05");
      assert.equal(plan.titleIndex, 2);
      assert.equal(plan.carry, true);
    }
    const monday = livePlan("2026-11-09");
    assert.equal(monday.weekOf, "2026-11-09");
    assert.equal(monday.liveDate, "2026-11-10");
    assert.equal(monday.titleIndex, 0);
  });
});

describe("title schedule", () => {
  const nashua = visit();
  const secaucus = visit({
    postalcode: "07094",
    city: "Secaucus",
    state: "NJ",
    metro: "New York, NY",
    referencenumber: "HTL-07094-20261102-store-auditor-01",
  });

  it("leaves unapproved jobs out of the catalog and the feeds", () => {
    const schedule = generateSchedule([nashua, secaucus], titles, "2026-11-04");
    assert.equal(schedule.week_of, "2026-11-02");
    assert.equal(schedule.slots.length, 6);
    assert.equal(schedule.slots.every((item) => item.approved === false), true);
    const applied = applySchedule([nashua, secaucus], schedule, "2026-11-04");
    assert.deepEqual(
      applied.map((job) => job.referencenumber),
      [nashua.referencenumber, secaucus.referencenumber],
    );
    assert.equal(applied.every((job) => job.status === "open"), true);
    const indeed = buildFeedXml(applied, "http://127.0.0.1:43123");
    const adzuna = buildAdzunaFeedXml(applied, "http://127.0.0.1:43123");
    const zip = buildZipRecruiterFeedXml(applied, "http://127.0.0.1:43123");
    for (const item of schedule.slots) {
      assert.equal(indeed.includes(item.referencenumber), false);
      assert.equal(adzuna.includes(item.referencenumber), false);
      assert.equal(zip.includes(item.referencenumber), false);
    }
    assert.equal(indeed.includes(nashua.referencenumber), true);
    assert.equal(adzuna.includes(secaucus.referencenumber), true);
  });

  it("opens one approved title per ZIP and keeps Friday on Thursday's job", () => {
    const schedule = approve(generateSchedule([nashua, secaucus], titles, "2026-11-04"));
    const tuesday = applySchedule([nashua, secaucus], schedule, "2026-11-03");
    const wednesday = applySchedule(tuesday, schedule, "2026-11-04");
    const thursday = applySchedule(wednesday, schedule, "2026-11-05");
    const friday = applySchedule(thursday, schedule, "2026-11-06");
    const sunday = applySchedule(friday, schedule, "2026-11-08");

    for (const jobs of [tuesday, wednesday, thursday, friday, sunday]) {
      assert.equal(openFor(jobs, "03060").length, 1);
      assert.equal(openFor(jobs, "07094").length, 1);
    }

    const tue = openFor(tuesday, "03060")[0];
    const wed = openFor(wednesday, "03060")[0];
    const thu = openFor(thursday, "03060")[0];
    const fri = openFor(friday, "03060")[0];
    const sun = openFor(sunday, "03060")[0];
    assert.equal(tue.title_id, "store-auditor");
    assert.equal(tue.title, "On-Demand Store Auditor");
    assert.equal(tue.referencenumber, "HTL-03060-20261103-store-auditor-01");
    assert.equal(wed.title_id, "retail-merchandiser");
    assert.equal(wed.title, "Retail Merchandiser");
    assert.equal(wed.referencenumber, "HTL-03060-20261104-retail-merchandiser-01");
    assert.equal(thu.title_id, "mystery-shopper");
    assert.equal(thu.title, "Mystery Shopper");
    assert.equal(thu.referencenumber, "HTL-03060-20261105-mystery-shopper-01");
    assert.equal(new Set([tue.referencenumber, wed.referencenumber, thu.referencenumber]).size, 3);
    assert.equal(fri.referencenumber, thu.referencenumber);
    assert.equal(fri.title, thu.title);
    assert.equal(sun.referencenumber, thu.referencenumber);
    assert.equal(sun.title_id, "mystery-shopper");

    const closedTuesday = wednesday.find((job) => job.referencenumber === tue.referencenumber);
    assert.equal(closedTuesday?.status, "closed");
    assert.equal(wednesday.some((job) => job.referencenumber === nashua.referencenumber), true);
    assert.equal(
      wednesday.find((job) => job.referencenumber === nashua.referencenumber)?.status,
      "closed",
    );

    const feeds = [
      buildFeedXml(thursday, "http://127.0.0.1:43123"),
      buildAdzunaFeedXml(thursday, "http://127.0.0.1:43123"),
      buildZipRecruiterFeedXml(thursday, "http://127.0.0.1:43123"),
    ];
    for (const xml of feeds) {
      assert.equal(xml.includes(thu.referencenumber), true);
      assert.equal(xml.includes(thu.title), true);
      assert.equal(xml.includes(tue.referencenumber), false);
      assert.equal(xml.includes(wed.referencenumber), false);
      assert.equal(xml.includes(nashua.referencenumber), false);
    }
    assert.equal(wed.description_html.includes("$6 to $17 per audit, depending on size"), true);
    assert.equal(wed.pay, "$6 - $17 per audit");
    const href = buildOnelink(thu);
    assert.equal(href.includes("c=mystery-shopper"), true);
    assert.equal(href.includes("af_sub1=03060"), true);
    assert.equal(href.includes(`af_sub2=${thu.referencenumber}`), true);
    assert.equal(href.includes("pid=Indeed"), true);
    assert.equal(href.split("pid=").length, 2);
  });

  it("does not reuse a reference number when the title changes", () => {
    const taken = visit({
      referencenumber: "HTL-03060-20261103-store-auditor-01",
      date_posted: "2026-10-01",
      status: "closed",
      title_id: "store-auditor",
    });
    const schedule = generateSchedule([nashua, taken], titles, "2026-11-04");
    const tuesday = slot(schedule, "03060", "2026-11-03");
    assert.equal(tuesday.referencenumber, "HTL-03060-20261103-store-auditor-02");
    assert.notEqual(tuesday.referencenumber, taken.referencenumber);
    const published = applySchedule([nashua, taken], approve(schedule), "2026-11-03");
    assert.equal(published.filter((job) => job.referencenumber === taken.referencenumber).length, 1);
    assert.equal(
      published.find((job) => job.referencenumber === taken.referencenumber)?.status,
      "closed",
    );
  });

  it("keeps Andy's title edit and approval when the schedule is regenerated", () => {
    const first = generateSchedule([nashua], titles, "2026-11-04");
    const edited: TitleSchedule = {
      ...first,
      slots: first.slots.map((item) =>
        item.date === "2026-11-04"
          ? { ...item, title: "Retail Merchandiser - North", approved: true }
          : item,
      ),
    };
    const again = generateSchedule([nashua], titles, "2026-11-04", edited);
    const wednesday = slot(again, "03060", "2026-11-04");
    assert.equal(wednesday.title, "Retail Merchandiser - North");
    assert.equal(wednesday.approved, true);
    assert.equal(wednesday.referencenumber, slot(first, "03060", "2026-11-04").referencenumber);
    assert.equal(slot(again, "03060", "2026-11-03").approved, false);
  });

  it("closes last week on Monday and opens the new week only when it is approved", () => {
    const prior = visit({
      referencenumber: "HTL-03060-20261105-mystery-shopper-01",
      title: "Mystery Shopper",
      title_id: "mystery-shopper",
      date_posted: "2026-11-05",
      valid_through: "2026-11-08",
    });
    const proposal = generateSchedule([prior], titles, "2026-11-09");
    assert.equal(proposal.week_of, "2026-11-09");
    const waiting = applySchedule([prior], proposal, "2026-11-09");
    assert.equal(openFor(waiting, "03060").length, 0);
    assert.equal(waiting.find((job) => job.referencenumber === prior.referencenumber)?.status, "closed");
    assert.equal(waiting.length, 1);

    const ready = approve(proposal, ["2026-11-10"]);
    const opened = applySchedule([prior], ready, "2026-11-09");
    const live = openFor(opened, "03060");
    assert.equal(live.length, 1);
    assert.equal(live[0].title_id, "store-auditor");
    assert.equal(live[0].referencenumber, "HTL-03060-20261110-store-auditor-01");
    assert.equal(live[0].date_posted, "2026-11-10");
    assert.equal(opened.find((job) => job.referencenumber === prior.referencenumber)?.status, "closed");
    const tuesday = applySchedule(opened, ready, "2026-11-10");
    assert.equal(openFor(tuesday, "03060")[0].referencenumber, live[0].referencenumber);
  });
});

describe("committed title schedule", () => {
  it("proposes the current sheet week and does not publish unapproved jobs", () => {
    const schedule = JSON.parse(
      fs.readFileSync("data/title-schedule.json", "utf8"),
    ) as TitleSchedule;
    const jobs = loadJobs();
    const zips = new Set(jobs.filter((job) => job.metro).map((job) => job.postalcode));
    assert.equal(schedule.week_of, "2026-11-02");
    assert.equal(schedule.slots.length, zips.size * 3);
    assert.equal(schedule.slots.every((item) => item.approved === false), true);
    const byZip = new Map<string, string[]>();
    const refs = new Set(jobs.map((job) => job.referencenumber));
    for (const item of schedule.slots) {
      const days = byZip.get(item.postalcode) ?? [];
      days.push(item.date);
      byZip.set(item.postalcode, days);
      assert.equal(refs.has(item.referencenumber), false);
      assert.match(
        item.referencenumber,
        new RegExp(`^HTL-${item.postalcode}-${item.date.replaceAll("-", "")}-${item.title_id}-\\d{2}$`),
      );
    }
    for (const dates of byZip.values()) {
      assert.deepEqual(dates, ["2026-11-03", "2026-11-04", "2026-11-05"]);
    }
    const openRefs = new Set(jobs.filter((job) => job.status === "open").map((job) => job.referencenumber));
    const applied = applySchedule(jobs, schedule, "2026-11-04");
    assert.deepEqual(
      new Set(applied.filter((job) => job.status === "open").map((job) => job.referencenumber)),
      openRefs,
    );
  });
});
