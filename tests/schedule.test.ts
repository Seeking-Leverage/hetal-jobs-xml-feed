import assert from "node:assert/strict";
import { describe, it } from "node:test";

import titlesFile from "../data/titles.json";
import { parseTitles, titleForDate, weekdayName } from "../lib/schedule";

const titles = parseTitles(titlesFile);

describe("weekday titles", () => {
  it("uses one title on Tuesday, Wednesday, and Thursday", () => {
    assert.deepEqual(
      titles.map((title) => title.title_id),
      ["store-auditor", "retail-merchandiser", "mystery-shopper"],
    );
    assert.equal(weekdayName("2026-11-03"), "Tuesday");
    assert.equal(titleForDate("2026-11-03", titles)?.title, "On-Demand Store Auditor");
    assert.equal(titleForDate("2026-11-04", titles)?.title, "Retail Merchandiser");
    assert.equal(titleForDate("2026-11-05", titles)?.title, "Mystery Shopper");
    for (const day of ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"]) {
      assert.equal(titleForDate(day, titles), null);
    }
  });
});
