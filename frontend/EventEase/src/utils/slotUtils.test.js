// Testi so neodvisni od časovnega pasu stroja: pas nastavimo na Ljubljano (UTC+1/+2),
// da se razlika med lokalnim in UTC datumom pri isPastDate dejansko pokaže.
process.env.TZ = "Europe/Ljubljana";

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getDateStr,
  getTimeStr,
  getVoteKey,
  groupByDate,
  nextVoteStatus,
  applyVoteStatus,
  cycleVoteStatus,
  formatBackendSlot,
  toLocalISODate,
  isPastDate,
} from "./slotUtils.js";

describe("getDateStr", () => {
  it("should extract the date when given an ISO string with 'T'", () => {
    assert.equal(getDateStr("2026-06-15T14:00:00"), "2026-06-15");
  });

  it("should extract the date when given a Postgres timestamp with a space", () => {
    assert.equal(getDateStr("2026-06-15 14:00:00+00"), "2026-06-15");
  });

  it("should prefer the 'date' field over 'start_time' when both exist", () => {
    assert.equal(getDateStr({ date: "2026-01-01", start_time: "2026-02-02T10:00:00" }), "2026-01-01");
  });

  it("should use 'start_time' when the object has no 'date'", () => {
    assert.equal(getDateStr({ start_time: "2026-02-02 10:00:00+00" }), "2026-02-02");
  });

  it("should return an empty string when the input has no usable date", () => {
    assert.equal(getDateStr(null), "");
    assert.equal(getDateStr(undefined), "");
    assert.equal(getDateStr(""), "");
    assert.equal(getDateStr({}), "");
  });
});

describe("getTimeStr", () => {
  it("should return HH:MM from an ISO start_time", () => {
    assert.equal(getTimeStr({ start_time: "2026-06-15T09:05:00" }), "09:05");
  });

  it("should return HH:MM from a Postgres start_time", () => {
    assert.equal(getTimeStr({ start_time: "2026-06-15 18:30:00+02" }), "18:30");
  });

  it("should prefer an explicit 'time' field", () => {
    assert.equal(getTimeStr({ time: "07:15", start_time: "2026-06-15T09:05:00" }), "07:15");
  });

  it("should fall back to 12:00 when start_time has no time part", () => {
    assert.equal(getTimeStr({ start_time: "2026-06-15" }), "12:00");
    assert.equal(getTimeStr({ date: "2026-06-15" }), "12:00");
  });

  it("should return an empty string when the item is missing", () => {
    assert.equal(getTimeStr(null), "");
  });
});

describe("getVoteKey", () => {
  it("should use the slot id when present", () => {
    assert.equal(getVoteKey({ id: "abc", date: "2026-06-15" }), "abc");
  });

  it("should fall back to the date when the slot has no id", () => {
    assert.equal(getVoteKey({ start_time: "2026-06-15T10:00:00" }), "2026-06-15");
    assert.equal(getVoteKey("2026-06-15"), "2026-06-15");
  });

  it("should return an empty string when there is neither id nor date", () => {
    assert.equal(getVoteKey(undefined), "");
  });
});

describe("groupByDate", () => {
  it("should group slots of the same day and keep their order", () => {
    const a = { id: "a", start_time: "2026-06-15T10:00:00" };
    const b = { id: "b", start_time: "2026-06-16 09:00:00+00" };
    const c = { id: "c", date: "2026-06-15" };
    assert.deepEqual(groupByDate([a, b, c]), { "2026-06-15": [a, c], "2026-06-16": [b] });
  });

  it("should skip items without a date", () => {
    assert.deepEqual(groupByDate([{ id: "x" }, null]), {});
  });

  it("should return an empty object when called without items", () => {
    assert.deepEqual(groupByDate(), {});
  });
});

describe("nextVoteStatus", () => {
  it("should cycle no -> yes -> if_needed -> no", () => {
    assert.equal(nextVoteStatus("no"), "yes");
    assert.equal(nextVoteStatus("yes"), "if_needed");
    assert.equal(nextVoteStatus("if_needed"), "no");
  });

  it("should treat the backend status 'if_need_be' like 'if_needed' and move to 'no'", () => {
    assert.equal(nextVoteStatus("if_need_be"), "no");
  });

  it("should treat a missing or unknown status as 'no' and move to 'yes'", () => {
    assert.equal(nextVoteStatus(undefined), "yes");
    assert.equal(nextVoteStatus("garbage"), "yes");
  });
});

describe("applyVoteStatus", () => {
  it("should set the status for the given key", () => {
    assert.deepEqual(applyVoteStatus({ a: "yes" }, "b", "if_needed"), { a: "yes", b: "if_needed" });
  });

  it("should remove the key when the new status is 'no' or empty", () => {
    assert.deepEqual(applyVoteStatus({ a: "yes", b: "yes" }, "a", "no"), { b: "yes" });
    assert.deepEqual(applyVoteStatus({ a: "yes" }, "a", null), {});
  });

  it("should not mutate the original statuses object", () => {
    const original = Object.freeze({ a: "yes" });
    const updated = applyVoteStatus(original, "a", "no");
    assert.notEqual(updated, original);
    assert.deepEqual(original, { a: "yes" });
  });
});

describe("cycleVoteStatus", () => {
  it("should call onChange once with the next status when the slot has no vote yet", () => {
    const onChange = mock.fn();
    const handled = cycleVoteStatus({ id: "s1" }, { s2: "yes" }, onChange);

    assert.equal(handled, true);
    assert.equal(onChange.mock.callCount(), 1);
    assert.deepEqual(onChange.mock.calls[0].arguments, [{ s1: "yes", s2: "yes" }]);
  });

  it("should remove the slot from statuses when cycling from if_needed back to no", () => {
    const onChange = mock.fn();
    cycleVoteStatus({ id: "s1" }, { s1: "if_needed" }, onChange);
    assert.deepEqual(onChange.mock.calls[0].arguments[0], {});
  });

  it("should key the vote by date when the slot has no id", () => {
    const onChange = mock.fn();
    cycleVoteStatus("2026-06-15", { "2026-06-15": "yes" }, onChange);
    assert.deepEqual(onChange.mock.calls[0].arguments[0], { "2026-06-15": "if_needed" });
  });

  it("should not call onChange and return false when the item has no key", () => {
    const onChange = mock.fn();
    assert.equal(cycleVoteStatus({}, {}, onChange), false);
    assert.equal(onChange.mock.callCount(), 0);
  });

  it("should return false without throwing when onChange is not provided", () => {
    assert.equal(cycleVoteStatus({ id: "s1" }, {}, undefined), false);
  });
});

describe("formatBackendSlot", () => {
  it("should create a one-hour slot on the same day for a normal time", () => {
    assert.deepEqual(formatBackendSlot("2026-06-15", "14:30"), {
      start_time: "2026-06-15T14:30:00",
      end_time: "2026-06-15T15:30:00",
    });
  });

  it("should move the end to the next day when the slot crosses midnight", () => {
    assert.deepEqual(formatBackendSlot("2026-06-15", "23:30"), {
      start_time: "2026-06-15T23:30:00",
      end_time: "2026-06-16T00:30:00",
    });
  });

  it("should roll over the month and the year at the end of December", () => {
    assert.equal(formatBackendSlot("2026-12-31", "23:00").end_time, "2027-01-01T00:00:00");
  });

  it("should handle the leap day correctly", () => {
    assert.equal(formatBackendSlot("2028-02-28", "23:15").end_time, "2028-02-29T00:15:00");
    assert.equal(formatBackendSlot("2028-02-29", "23:15").end_time, "2028-03-01T00:15:00");
  });

  it("should handle midnight as a start time", () => {
    assert.deepEqual(formatBackendSlot("2026-06-15", "00:00"), {
      start_time: "2026-06-15T00:00:00",
      end_time: "2026-06-15T01:00:00",
    });
  });

  it("should respect a custom duration", () => {
    assert.equal(formatBackendSlot("2026-06-15", "10:00", 90).end_time, "2026-06-15T11:30:00");
  });

  it("should not depend on daylight saving time changes in the local time zone", () => {
    // 29. 3. 2026 se v Ljubljani ura premakne naprej; trajanje mora vseeno ostati 1 h.
    assert.equal(formatBackendSlot("2026-03-29", "01:30").end_time, "2026-03-29T02:30:00");
  });

  for (const badDate of ["2026-6-15", "15.06.2026", "", null, undefined, "2026-02-30", "2026-13-01"]) {
    it(`should throw TypeError when the date is ${JSON.stringify(badDate)}`, () => {
      assert.throws(() => formatBackendSlot(badDate, "10:00"), { name: "TypeError", message: /date/i });
    });
  }

  for (const badTime of ["24:00", "25:30", "9:00", "10:60", "", "10:00:00", null]) {
    it(`should throw TypeError when the time is ${JSON.stringify(badTime)}`, () => {
      // Preverimo tudi razlog: "24:00" bi sicer lahko padel šele na preverjanju datuma.
      assert.throws(() => formatBackendSlot("2026-06-15", badTime), { name: "TypeError", message: /Invalid time/ });
    });
  }

  for (const badDuration of [0, -30, 1.5]) {
    it(`should throw RangeError when the duration is ${badDuration}`, () => {
      assert.throws(() => formatBackendSlot("2026-06-15", "10:00", badDuration), { name: "RangeError", message: /Duration/ });
    });
  }
});

describe("toLocalISODate / isPastDate", () => {
  afterEach(() => mock.timers.reset());

  it("should use the local calendar day, not the UTC day", () => {
    // 15. 6. 2026 ob 00:30 v Ljubljani je v UTC še 14. 6.
    const justAfterMidnight = new Date(2026, 5, 15, 0, 30);
    assert.equal(toLocalISODate(justAfterMidnight), "2026-06-15");
    assert.equal(isPastDate("2026-06-14", justAfterMidnight), true);
  });

  it("should not treat today as a past date", () => {
    assert.equal(isPastDate("2026-06-15", new Date(2026, 5, 15, 23, 59)), false);
  });

  it("should not treat a future date as past", () => {
    assert.equal(isPastDate("2026-06-16", new Date(2026, 5, 15, 12, 0)), false);
  });

  it("should use the current clock when no date is passed", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date(2026, 0, 10, 8, 0) });
    assert.equal(toLocalISODate(), "2026-01-10");
    assert.equal(isPastDate("2026-01-09"), true);
    assert.equal(isPastDate("2026-01-10"), false);
  });
});
