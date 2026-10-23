const UNKNOWN_VOTER = "Neznanec";
const MAYBE_STATUSES = new Set(["if_need_be", "if_needed"]);

function emptyTally() {
  return {
    yesCount: 0,
    yesVoters: [],
    maybeCount: 0,
    maybeVoters: [],
    yesPercent: 0,
    maybePercent: 0,
  };
}

function percentOf(count, total) {
  if (total === 0) return 0;
  return Math.round((count / total) * 100);
}

/**
 * Prešteje glasove po terminih.
 * Vsak udeleženec šteje največ enkrat na termin (velja zadnja izbira),
 * glasovi za termine, ki niso v seznamu, se ne upoštevajo.
 */
export function tallyVotes(slots = [], votes = []) {
  const tally = {};
  slots.forEach((slot) => {
    tally[slot.id] = emptyTally();
  });

  votes.forEach((voteRecord) => {
    const voterName = voteRecord?.participant_name || UNKNOWN_VOTER;
    const choices = voteRecord?.choices || voteRecord?.date_votes || [];

    const statusBySlot = new Map();
    choices.forEach((choice) => {
      if (choice && choice.slot_id in tally) statusBySlot.set(choice.slot_id, choice.status);
    });

    statusBySlot.forEach((status, slotId) => {
      const slotTally = tally[slotId];
      if (status === "yes") {
        slotTally.yesCount += 1;
        slotTally.yesVoters.push(voterName);
      } else if (MAYBE_STATUSES.has(status)) {
        slotTally.maybeCount += 1;
        slotTally.maybeVoters.push(voterName);
      }
    });
  });

  const participantCount = votes.length;
  Object.values(tally).forEach((slotTally) => {
    slotTally.yesPercent = percentOf(slotTally.yesCount, participantCount);
    slotTally.maybePercent = percentOf(slotTally.maybeCount, participantCount);
  });

  return tally;
}

/** Slovenska oblika samostalnika »glas« glede na število (ednina, dvojina, množina). */
export function slovenianVoteLabel(count) {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Vote count must be a non-negative integer, got: ${count}`);
  }
  const mod100 = count % 100;
  if (mod100 === 1) return "glas";
  if (mod100 === 2) return "glasa";
  if (mod100 === 3 || mod100 === 4) return "glasovi";
  return "glasov";
}
