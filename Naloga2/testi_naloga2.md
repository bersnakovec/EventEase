# Testi enot – Naloga 2

Izvorna koda vseh novih in popravljenih testov enot (stanje na `main`, commit `ed1d457` in naprej).
Utemeljitev enot, ukaz agentu, namerne napake in pregled pomanjkljivih testov so v [porocilo_naloga2.md](../porocilo_naloga2.md).

| Enota | Datoteka s testi | Ogrodje |
|---|---|---|
| Štetje glasov (`tallyVotes`, `slovenianVoteLabel`) | [voteTally.test.js](../frontend/EventEase/src/utils/voteTally.test.js) | `node:test` |
| Termini (`formatBackendSlot`, `cycleVoteStatus`, …) | [slotUtils.test.js](../frontend/EventEase/src/utils/slotUtils.test.js) | `node:test` + `mock` |
| Generiranje .ics (`formatIcsTimestamp`, `buildIcsContent`, …) | [ics.zig](../backend/logic/src/ics.zig) (blok `Tests`) | `std.testing` |
| Obstoječi pomožni testi (popravljeni) | [eventHelpers.test.js](../frontend/EventEase/src/utils/eventHelpers.test.js) | `node:test` |

Zagon:

```bash
cd frontend/EventEase && npm run test:coverage
cd backend/logic && zig build test --summary all
```

## 1. Štetje glasov – `voteTally.test.js`

Vir: [frontend/EventEase/src/utils/voteTally.test.js](../frontend/EventEase/src/utils/voteTally.test.js) · izvedenih testov: 35

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tallyVotes, slovenianVoteLabel } from "./voteTally.js";

const slots = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

const vote = (name, ...choices) => ({
  participant_name: name,
  choices: choices.map(([slot_id, status]) => ({ slot_id, status })),
});

describe("tallyVotes", () => {
  it("should return a zeroed entry for every slot when there are no votes", () => {
    const zero = { yesCount: 0, yesVoters: [], maybeCount: 0, maybeVoters: [], yesPercent: 0, maybePercent: 0 };
    assert.deepEqual(tallyVotes(slots, []), { s1: zero, s2: zero, s3: zero });
  });

  it("should return an empty object when there are no slots", () => {
    assert.deepEqual(tallyVotes([], [vote("Ana", ["s1", "yes"])]), {});
  });

  it("should count yes and if-need-be votes per slot and list voter names in vote order", () => {
    const result = tallyVotes(slots, [
      vote("Ana", ["s1", "yes"], ["s2", "if_need_be"]),
      vote("Bor", ["s1", "yes"], ["s2", "no"]),
      vote("Cene", ["s1", "if_need_be"], ["s3", "yes"]),
    ]);

    assert.equal(result.s1.yesCount, 2);
    assert.deepEqual(result.s1.yesVoters, ["Ana", "Bor"]);
    assert.equal(result.s1.maybeCount, 1);
    assert.deepEqual(result.s1.maybeVoters, ["Cene"]);

    assert.equal(result.s2.yesCount, 0);
    assert.deepEqual(result.s2.maybeVoters, ["Ana"]);

    assert.deepEqual(result.s3.yesVoters, ["Cene"]);
  });

  it("should not count 'no' or unknown statuses", () => {
    const result = tallyVotes(slots, [vote("Ana", ["s1", "no"], ["s2", "maybe"], ["s3", "YES"])]);
    for (const id of ["s1", "s2", "s3"]) {
      assert.equal(result[id].yesCount, 0, id);
      assert.equal(result[id].maybeCount, 0, id);
    }
  });

  it("should treat the frontend status 'if_needed' the same as the backend status 'if_need_be'", () => {
    const result = tallyVotes(slots, [vote("Ana", ["s1", "if_needed"]), vote("Bor", ["s1", "if_need_be"])]);
    assert.equal(result.s1.maybeCount, 2);
    assert.deepEqual(result.s1.maybeVoters, ["Ana", "Bor"]);
  });

  it("should read choices from 'date_votes' when 'choices' is missing", () => {
    const result = tallyVotes(slots, [
      { participant_name: "Ana", date_votes: [{ slot_id: "s2", status: "yes" }] },
    ]);
    assert.equal(result.s2.yesCount, 1);
  });

  it("should use 'Neznanec' as the voter name when the name is missing or empty", () => {
    const result = tallyVotes(slots, [
      { choices: [{ slot_id: "s1", status: "yes" }] },
      { participant_name: "", choices: [{ slot_id: "s1", status: "yes" }] },
    ]);
    assert.deepEqual(result.s1.yesVoters, ["Neznanec", "Neznanec"]);
  });

  it("should ignore votes for slots that are not part of the poll", () => {
    const result = tallyVotes(slots, [vote("Ana", ["unknown", "yes"], ["s1", "yes"])]);
    assert.deepEqual(Object.keys(result), ["s1", "s2", "s3"]);
    assert.equal(result.s1.yesCount, 1);
  });

  it("should count a participant at most once per slot, using their last choice", () => {
    const result = tallyVotes(slots, [vote("Ana", ["s1", "yes"], ["s1", "yes"], ["s2", "yes"], ["s2", "if_need_be"])]);
    assert.equal(result.s1.yesCount, 1);
    assert.equal(result.s1.yesPercent, 100);
    assert.equal(result.s2.yesCount, 0);
    assert.equal(result.s2.maybeCount, 1);
  });

  it("should compute percentages relative to the number of participants and round them", () => {
    const result = tallyVotes(slots, [
      vote("Ana", ["s1", "yes"], ["s2", "if_need_be"]),
      vote("Bor", ["s1", "yes"]),
      vote("Cene", ["s2", "yes"]),
    ]);
    assert.equal(result.s1.yesPercent, 67); // 2/3 = 66.67 %
    assert.equal(result.s2.yesPercent, 33); // 1/3 = 33.33 %
    assert.equal(result.s2.maybePercent, 33);
    assert.equal(result.s3.yesPercent, 0);
  });

  it("should count participants without any choices in the percentage denominator", () => {
    const result = tallyVotes(slots, [vote("Ana", ["s1", "yes"]), { participant_name: "Bor" }]);
    assert.equal(result.s1.yesPercent, 50);
  });

  it("should not mutate the input arrays", () => {
    const votes = [vote("Ana", ["s1", "yes"])];
    const snapshot = structuredClone({ slots, votes });
    tallyVotes(slots, votes);
    assert.deepEqual({ slots, votes }, snapshot);
  });

  it("should return an empty object when called without arguments", () => {
    assert.deepEqual(tallyVotes(), {});
  });

  it("should skip null vote records but still count them as participants", () => {
    const result = tallyVotes(slots, [null, vote("Ana", ["s1", "yes"])]);
    assert.equal(result.s1.yesCount, 1);
    assert.equal(result.s1.yesPercent, 50);
  });
});

describe("slovenianVoteLabel", () => {
  const cases = [
    [0, "glasov"],
    [1, "glas"],
    [2, "glasa"],
    [3, "glasovi"],
    [4, "glasovi"],
    [5, "glasov"],
    [11, "glasov"],
    [12, "glasov"],
    [21, "glasov"],
    [100, "glasov"],
    [101, "glas"],
    [102, "glasa"],
    [103, "glasovi"],
    [111, "glasov"],
    [1001, "glas"],
  ];
  for (const [count, expected] of cases) {
    it(`should return '${expected}' when count is ${count}`, () => {
      assert.equal(slovenianVoteLabel(count), expected);
    });
  }

  for (const invalid of [-1, 1.5, NaN, "2", null, undefined]) {
    it(`should throw RangeError when count is ${typeof invalid === "string" ? JSON.stringify(invalid) : String(invalid)}`, () => {
      assert.throws(() => slovenianVoteLabel(invalid), RangeError);
    });
  }
});
```

## 2. Termini – `slotUtils.test.js`

Vir: [frontend/EventEase/src/utils/slotUtils.test.js](../frontend/EventEase/src/utils/slotUtils.test.js) · izvedenih testov: 55 (vključno z mocki `mock.fn` in `mock.timers`)

```js
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
```

## 3. Generiranje .ics – testi v `ics.zig`

Vir: [backend/logic/src/ics.zig](../backend/logic/src/ics.zig) · izvedenih testov: 18 (vključno z `FailingAllocator`)

```zig
// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

const testing = std.testing;

fn expectIcsTimestamp(expected: []const u8, input: []const u8) !void {
    var buf: [timestamp_len]u8 = undefined;
    try testing.expectEqualStrings(expected, try formatIcsTimestamp(&buf, input));
}

/// Returns the value of an iCalendar property line ("NAME:value\r\n") or null.
fn icsProperty(ics: []const u8, name: []const u8) ?[]const u8 {
    var lines = std.mem.splitSequence(u8, ics, "\r\n");
    while (lines.next()) |line| {
        if (line.len > name.len and std.mem.startsWith(u8, line, name) and line[name.len] == ':') {
            return line[name.len + 1 ..];
        }
    }
    return null;
}

const fixed_dtstamp: i64 = 1_781_352_000; // 2026-06-13T12:00:00Z

test "formatIcsTimestamp: should convert an ISO UTC timestamp with Z" {
    try expectIcsTimestamp("20240615T140000Z", "2024-06-15T14:00:00Z");
}

test "formatIcsTimestamp: should convert a PostgreSQL timestamptz with a space and +00 offset" {
    try expectIcsTimestamp("20260615T140000Z", "2026-06-15 14:00:00+00");
}

test "formatIcsTimestamp: should treat a timestamp without offset as UTC" {
    try expectIcsTimestamp("20260615T140000Z", "2026-06-15T14:00:00");
    try expectIcsTimestamp("20260615T140000Z", "2026-06-15T14:00");
}

test "formatIcsTimestamp: should convert positive and negative offsets to UTC" {
    try expectIcsTimestamp("20260615T120000Z", "2026-06-15 14:00:00+02");
    try expectIcsTimestamp("20260615T083000Z", "2026-06-15 14:00:00+05:30");
    try expectIcsTimestamp("20260615T190000Z", "2026-06-15T14:00:00-0500");
}

test "formatIcsTimestamp: should move the date when the offset crosses midnight, month and year" {
    try expectIcsTimestamp("20251231T230000Z", "2026-01-01 00:00:00+01");
    try expectIcsTimestamp("20260301T010000Z", "2026-02-28 20:00:00-05");
    try expectIcsTimestamp("20280229T230000Z", "2028-03-01 01:00:00+02");
}

test "formatIcsTimestamp: should ignore fractional seconds" {
    try expectIcsTimestamp("20260615T140005Z", "2026-06-15 14:00:05.123456+00");
}

test "formatIcsTimestamp: should accept the leap day only in leap years" {
    try expectIcsTimestamp("20280229T100000Z", "2028-02-29T10:00:00Z");
    try expectIcsTimestamp("20000229T100000Z", "2000-02-29T10:00:00Z");
    var buf: [timestamp_len]u8 = undefined;
    try testing.expectError(error.InvalidTimestamp, formatIcsTimestamp(&buf, "2026-02-29T10:00:00Z"));
    try testing.expectError(error.InvalidTimestamp, formatIcsTimestamp(&buf, "1900-02-29T10:00:00Z"));
}

test "formatIcsTimestamp: should return InvalidTimestamp for malformed input" {
    const invalid = [_][]const u8{
        "",
        "2026-06-15",
        "not a timestamp",
        "2026/06/15 14:00:00",
        "2026-06-15X14:00:00",
        "2026-13-01T10:00:00Z",
        "2026-00-10T10:00:00Z",
        "2026-04-31T10:00:00Z",
        "2026-06-15T24:00:00Z",
        "2026-06-15T10:60:00Z",
        "2026-06-15T10:00:60Z",
        "2026-06-15T10:00:00.Z",
        "2026-06-15T10:00:00+2",
        "2026-06-15T10:00:00+24",
        "2026-06-15T10:00:00Q",
        "2026-06-15T10:00:00Z trailing",
        "2026-06-15 14:00:00+00:00:00 with a very long tail that would overflow a fixed buffer",
    };
    var buf: [timestamp_len]u8 = undefined;
    for (invalid) |input| {
        testing.expectError(error.InvalidTimestamp, formatIcsTimestamp(&buf, input)) catch |err| {
            std.debug.print("input accepted unexpectedly: \"{s}\"\n", .{input});
            return err;
        };
    }
}

test "formatUnixUtc: should format dates before 1970 and reject years outside 0000-9999" {
    var buf: [timestamp_len]u8 = undefined;
    try testing.expectEqualStrings("19700101T000000Z", try formatUnixUtc(&buf, 0));
    try testing.expectEqualStrings("19691231T235959Z", try formatUnixUtc(&buf, -1));
    try testing.expectEqualStrings("99991231T235959Z", try formatUnixUtc(&buf, 253_402_300_799));
    try testing.expectError(error.InvalidTimestamp, formatUnixUtc(&buf, 253_402_300_800));
}

test "escapeText: should escape backslash, semicolon, comma and newline and drop CR" {
    const escaped = try escapeText(testing.allocator, "a\\b;c,d\r\ne");
    defer testing.allocator.free(escaped);
    try testing.expectEqualStrings("a\\\\b\\;c\\,d\\ne", escaped);
}

test "escapeText: should leave plain and UTF-8 text unchanged" {
    const escaped = try escapeText(testing.allocator, "Izlet na Šmarno goro");
    defer testing.allocator.free(escaped);
    try testing.expectEqualStrings("Izlet na Šmarno goro", escaped);
}

test "buildIcsContent: should produce a valid VEVENT with UTC start, end and stamp" {
    const ics = try buildIcsContent(testing.allocator, "Ekipni sestanek", "2026-06-15 14:00:00+02", "2026-06-15 15:00:00+02", fixed_dtstamp);
    defer testing.allocator.free(ics);

    try testing.expect(std.mem.startsWith(u8, ics, "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
    try testing.expect(std.mem.endsWith(u8, ics, "END:VEVENT\r\nEND:VCALENDAR\r\n"));
    try testing.expectEqualStrings("20260615T120000Z", icsProperty(ics, "DTSTART").?);
    try testing.expectEqualStrings("20260615T130000Z", icsProperty(ics, "DTEND").?);
    try testing.expectEqualStrings("20260613T120000Z", icsProperty(ics, "DTSTAMP").?);
    try testing.expectEqualStrings("Ekipni sestanek", icsProperty(ics, "SUMMARY").?);
    try testing.expectEqualStrings("REQUEST", icsProperty(ics, "METHOD").?);
}

test "buildIcsContent: should use CRLF for every line break" {
    const ics = try buildIcsContent(testing.allocator, "Title", "2026-06-15T10:00:00Z", "2026-06-15T11:00:00Z", fixed_dtstamp);
    defer testing.allocator.free(ics);
    for (ics, 0..) |c, i| {
        if (c == '\n') try testing.expect(i > 0 and ics[i - 1] == '\r');
    }
}

test "buildIcsContent: should escape the title in SUMMARY so it cannot inject properties" {
    const ics = try buildIcsContent(testing.allocator, "Zabava, pijača; vse\nEND:VEVENT", "2026-06-15T10:00:00Z", "2026-06-15T11:00:00Z", fixed_dtstamp);
    defer testing.allocator.free(ics);
    try testing.expectEqualStrings("Zabava\\, pijača\\; vse\\nEND:VEVENT", icsProperty(ics, "SUMMARY").?);
    try testing.expectEqual(@as(usize, 1), std.mem.count(u8, ics, "\r\nEND:VEVENT\r\n"));
}

test "buildIcsContent: should create a UID without spaces that is stable and depends on title and start" {
    const a1 = try buildIcsContent(testing.allocator, "Izlet v hribe", "2026-06-15T10:00:00Z", "2026-06-15T11:00:00Z", fixed_dtstamp);
    defer testing.allocator.free(a1);
    const a2 = try buildIcsContent(testing.allocator, "Izlet v hribe", "2026-06-15T10:00:00Z", "2026-06-15T11:00:00Z", fixed_dtstamp + 3600);
    defer testing.allocator.free(a2);
    const other_title = try buildIcsContent(testing.allocator, "Drug dogodek", "2026-06-15T10:00:00Z", "2026-06-15T11:00:00Z", fixed_dtstamp);
    defer testing.allocator.free(other_title);
    const other_start = try buildIcsContent(testing.allocator, "Izlet v hribe", "2026-06-16T10:00:00Z", "2026-06-16T11:00:00Z", fixed_dtstamp);
    defer testing.allocator.free(other_start);

    const uid = icsProperty(a1, "UID").?;
    try testing.expect(std.mem.indexOfScalar(u8, uid, ' ') == null);
    try testing.expect(std.mem.endsWith(u8, uid, "@eventease"));
    try testing.expectEqualStrings(uid, icsProperty(a2, "UID").?);
    try testing.expect(!std.mem.eql(u8, uid, icsProperty(other_title, "UID").?));
    try testing.expect(!std.mem.eql(u8, uid, icsProperty(other_start, "UID").?));
}

test "buildIcsContent: should return InvalidTimeRange when the end is not after the start" {
    try testing.expectError(error.InvalidTimeRange, buildIcsContent(testing.allocator, "T", "2026-06-15T11:00:00Z", "2026-06-15T10:00:00Z", fixed_dtstamp));
    try testing.expectError(error.InvalidTimeRange, buildIcsContent(testing.allocator, "T", "2026-06-15T10:00:00Z", "2026-06-15T10:00:00Z", fixed_dtstamp));
    // isti trenutek v različnih pasovih ni veljaven interval
    try testing.expectError(error.InvalidTimeRange, buildIcsContent(testing.allocator, "T", "2026-06-15 12:00:00+02", "2026-06-15T10:00:00Z", fixed_dtstamp));
}

test "buildIcsContent: should return InvalidTimestamp for a malformed start or end" {
    try testing.expectError(error.InvalidTimestamp, buildIcsContent(testing.allocator, "T", "garbage", "2026-06-15T10:00:00Z", fixed_dtstamp));
    try testing.expectError(error.InvalidTimestamp, buildIcsContent(testing.allocator, "T", "2026-06-15T10:00:00Z", "", fixed_dtstamp));
}

fn buildWithAllocator(alloc: std.mem.Allocator) !void {
    const ics = try buildIcsContent(alloc, "Naslov, s; posebnimi znaki", "2026-06-15T10:00:00Z", "2026-06-15T11:00:00Z", fixed_dtstamp);
    alloc.free(ics);
}

test "buildIcsContent: should return OutOfMemory and not leak when any allocation fails" {
    // FailingAllocator (nadomestni objekt za alokator) odpove pri vsaki posamezni alokaciji po vrsti.
    try testing.checkAllAllocationFailures(testing.allocator, buildWithAllocator, .{});
}
```

## 4. Popravljeni obstoječi testi – `eventHelpers.test.js`

Vir: [frontend/EventEase/src/utils/eventHelpers.test.js](../frontend/EventEase/src/utils/eventHelpers.test.js) · izvedenih testov: 15

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  organizerNameFromEmail,
  isValidVoteStatus,
  buildSharePath,
} from "./eventHelpers.js";

describe("organizerNameFromEmail", () => {
  it("should return the local part when given a normal e-mail", () => {
    assert.equal(organizerNameFromEmail("janez.novak@mail.com"), "janez.novak");
  });

  it("should trim whitespace around the local part", () => {
    assert.equal(organizerNameFromEmail("  janez @mail.com"), "janez");
  });

  it("should return 'Organizator' when the e-mail is empty, null or not a string", () => {
    assert.equal(organizerNameFromEmail(""), "Organizator");
    assert.equal(organizerNameFromEmail(null), "Organizator");
    assert.equal(organizerNameFromEmail(undefined), "Organizator");
    assert.equal(organizerNameFromEmail(42), "Organizator");
  });

  it("should return 'Organizator' when the local part is empty or only whitespace", () => {
    assert.equal(organizerNameFromEmail("@mail.com"), "Organizator");
    assert.equal(organizerNameFromEmail("   @mail.com"), "Organizator");
  });

  it("should return the whole input when it contains no '@'", () => {
    assert.equal(organizerNameFromEmail("organizator"), "organizator");
  });
});

describe("isValidVoteStatus", () => {
  for (const status of ["yes", "no", "if_need_be"]) {
    it(`should accept the backend status '${status}'`, () => {
      assert.equal(isValidVoteStatus(status), true);
    });
  }

  // "if_needed" je frontendna vrednost – backend (CHECK v SQL) je ne sprejme, zato mora biti zavrnjena.
  for (const status of ["if_needed", "maybe", "YES", "", null, undefined]) {
    it(`should reject ${JSON.stringify(status) ?? "undefined"}`, () => {
      assert.equal(isValidVoteStatus(status), false);
    });
  }
});

describe("buildSharePath", () => {
  it("should build the /invite/:token route used by the router", () => {
    assert.equal(
      buildSharePath("550e8400-e29b-41d4-a716-446655440000"),
      "/invite/550e8400-e29b-41d4-a716-446655440000",
    );
  });
});
```
