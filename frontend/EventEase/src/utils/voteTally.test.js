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
