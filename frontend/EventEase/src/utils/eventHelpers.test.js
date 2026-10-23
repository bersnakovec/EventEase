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
