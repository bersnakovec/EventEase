import { tallyVotes, slovenianVoteLabel } from "../utils/voteTally.js";

export default function VoteResults({ suggestedDates = [], votes = [] }) {
  if (!suggestedDates.length) {
    return (
      <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.4 }}>
        Ni razpoložljivih terminov za prikaz rezultatov.
      </p>
    );
  }

  const tally = tallyVotes(suggestedDates, votes);

  const formatDate = (slot) => {
    const raw = slot.start_time || slot.date;
    if (!raw) return "";
    return new Date(raw).toLocaleDateString("sl-SI", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (slot) => {
    if (!slot.start_time) return null;
    const rawTime = slot.start_time.includes("T")
      ? slot.start_time.split("T")[1]
      : slot.start_time.split(" ")[1];
    return rawTime ? rawTime.slice(0, 5) : null;
  };

  const noVotesCast = votes.length === 0;

  return (
    <div
      className="rounded-xl overflow-hidden divide-y"
      style={{
        border: "1px solid color-mix(in srgb, var(--color-primary) 12%, transparent)",
        divideColor: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
      }}
    >
      {suggestedDates.map((slot) => {
        const {
          yesCount: voteCount,
          yesVoters: votersList,
          maybeCount,
          maybeVoters: maybeVotersList,
          yesPercent: yesPercentage,
          maybePercent: maybePercentage,
        } = tally[slot.id];
        const time = formatTime(slot);

        return (
          <div
            key={slot.id}
            className="px-4 py-3.5 flex items-center justify-between gap-4"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            {/* Left: date + voter names */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <p
                  className="text-sm font-medium capitalize"
                  style={{ color: "var(--color-text)" }}
                >
                  {formatDate(slot)}
                </p>
                {time && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--color-primary)", opacity: 0.6 }}
                  >
                    {time}
                  </span>
                )}
              </div>

              {noVotesCast ? (
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text)", opacity: 0.35 }}>
                  Še ni glasov
                </p>
              ) : (
                <div className="mt-0.5 space-y-0.5">
                  {votersList.length > 0 && (
                    <p className="text-xs truncate" style={{ color: "var(--color-text)", opacity: 0.55 }}>
                      Ustreza:{" "}
                      <span style={{ color: "var(--color-text)", opacity: 1, fontWeight: 500 }}>
                        {votersList.join(", ")}
                      </span>
                    </p>
                  )}
                  {maybeVotersList.length > 0 && (
                    <p className="text-xs truncate" style={{ color: "var(--color-text)", opacity: 0.45 }}>
                      Če bo potrebno:{" "}
                      <span style={{ fontWeight: 500 }}>{maybeVotersList.join(", ")}</span>
                    </p>
                  )}
                  {votersList.length === 0 && maybeVotersList.length === 0 && (
                    <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.3 }}>
                      Ni glasov za ta termin
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: progress bars + counts — hidden when no votes */}
            {!noVotesCast && (
              <div className="w-36 shrink-0 space-y-1.5">
                {/* Yes bar */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 rounded-full h-1 hidden sm:block"
                    style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}
                  >
                    <div
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        width: `${yesPercentage}%`,
                        backgroundColor: "var(--color-primary)",
                      }}
                    />
                  </div>
                  <span
                    className="text-xs tabular-nums text-right"
                    style={{
                      color: "var(--color-text)",
                      opacity: voteCount > 0 ? 0.8 : 0.35,
                      minWidth: "52px",
                      fontWeight: voteCount > 0 ? 500 : 400,
                    }}
                  >
                    {voteCount} {slovenianVoteLabel(voteCount)}
                  </span>
                </div>

                {/* Maybe bar — accent-2 as a thin progress fill, one of its few uses */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 rounded-full h-1 hidden sm:block"
                    style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}
                  >
                    <div
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        width: `${maybePercentage}%`,
                        backgroundColor: "var(--color-accent-2)",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span
                    className="text-xs tabular-nums text-right"
                    style={{
                      color: "var(--color-text)",
                      opacity: maybeCount > 0 ? 0.6 : 0.3,
                      minWidth: "52px",
                    }}
                  >
                    {maybeCount} {slovenianVoteLabel(maybeCount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}