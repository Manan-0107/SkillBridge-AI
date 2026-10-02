import test from "node:test";
import assert from "node:assert/strict";

function getTodayUtcString(mockDate) {
  const now = mockDate || new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayUtcString(referenceDateStr) {
  const date = referenceDateStr
    ? new Date(`${referenceDateStr}T00:00:00Z`)
    : new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

test("getTodayUtcString formats YYYY-MM-DD correctly in UTC", () => {
  const testDate = new Date("2026-09-14T23:59:59Z");
  assert.equal(getTodayUtcString(testDate), "2026-09-14");
});

test("getYesterdayUtcString rolls back month and year boundaries correctly", () => {
  assert.equal(getYesterdayUtcString("2026-09-14"), "2026-09-13");
  assert.equal(getYesterdayUtcString("2026-01-01"), "2025-12-31");
  assert.equal(getYesterdayUtcString("2026-03-01"), "2026-02-28");
});
