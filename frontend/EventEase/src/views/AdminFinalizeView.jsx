import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import VoteResults from "../components/VoteResults";
import CalendarPicker from "../components/CalendarPicker";
import FinalizedView from "./FinalizedView";

/** "2026-12-12 17:00:00+00" ali "2026-12-12T17:00:00" → "2026-12-12 ob 17:00" (INC-06). */
function formatSuggestionTime(startTime) {
  if (!startTime) return "";
  const [date, time = ""] = startTime.split(/[T ]/);
  return time ? `${date} ob ${time.slice(0, 5)}` : date;
}

export default function AdminFinalizeView({ eventData: propEventData, onBack }) {
  const { adminToken } = useParams();
  const [searchParams] = useSearchParams();
  const basicToken = searchParams.get("invite");

  const [fetchedData, setFetchedData] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalSlot, setFinalSlot] = useState(null);

  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [pendingSuggestion, setPendingSuggestion] = useState(null);
  const [notice, setNotice] = useState(null);
  const noticeRef = useRef(null);

  useEffect(() => {
    if (propEventData || !adminToken) return;
    async function fetchAdminData() {
      setApiLoading(true);
      try {
        const response = await fetch(`/api/polls/admin/${adminToken}`);
        if (!response.ok) throw new Error("Podatkov o dogodku ni mogoče najti. Preverite pravilnost povezave.");
        const data = await response.json();

        // Detect already-finalized poll
        if (data.is_finalized && data.final_slot_id) {
          const matched = (data.time_slots || []).find((s) => s.id === data.final_slot_id);
          setFinalSlot(matched || null);
          setIsFinalized(true);
          setFetchedData({ title: data.title, description: data.description });
          return;
        }

        setFetchedData({
          title: data.title,
          description: data.description,
          suggestedDates: (data.time_slots || []).map((slot) => ({
            id: slot.id,
            date: slot.start_time.replace(" ", "T").split("T")[0],
            start_time: slot.start_time.replace(" ", "T").split("+")[0],
            end_time: slot.end_time,
          })),
          votes: data.votes || [],
        });
        setSuggestions(
          (data.suggestions || []).map((s) => ({
            ...s,
            start_time: s.start_time.replace(" ", "T").split("+")[0],
          })),
        );
      } catch (err) {
        setApiError(err.message);
      } finally {
        setApiLoading(false);
      }
    }
    fetchAdminData();
  }, [adminToken, propEventData]);

  useEffect(() => {
    if (notice && noticeRef.current)
      noticeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [notice]);

  const handleSuggestionAction = async (suggestionId, action) => {
    if (action === "accept") {
      try {
        const response = await fetch(`/api/polls/admin/${adminToken}/accept-suggestion`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestion_id: suggestionId }),
        });
        if (!response.ok) { setNotice({ type: "error", message: "Napaka pri sprejemu predloga." }); return; }
        const refreshed = await fetch(`/api/polls/admin/${adminToken}`);
        if (refreshed.ok) {
          const data = await refreshed.json();
          setFetchedData({
            title: data.title,
            description: data.description,
            suggestedDates: (data.time_slots || []).map((slot) => ({
              id: slot.id,
              date: slot.start_time.replace(" ", "T").split("T")[0],
              start_time: slot.start_time.replace(" ", "T").split("+")[0],
              end_time: slot.end_time,
            })),
            votes: data.votes || [],
          });
          setSuggestions(
            (data.suggestions || []).map((s) => ({
              ...s,
              start_time: s.start_time.replace(" ", "T").split("+")[0],
            })),
          );
        }
      } catch {
        setNotice({ type: "error", message: "Omrežna napaka." });
        return;
      }
    }
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === suggestionId ? { ...s, status: action === "accept" ? "accepted" : "rejected" } : s,
      ),
    );
    setPendingSuggestion(null);
  };

  const handleFinalize = async (e) => {
    e.preventDefault();
    if (!adminToken) { setNotice({ type: "error", message: "Nimate skrbniških pravic za zaključek tega dogodka." }); return; }
    if (!selectedSlotId) { setNotice({ type: "error", message: "Prosimo, izberite končni termin za zaklep dogodka." }); return; }
    setNotice(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/polls/admin/${adminToken}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ final_slot_id: selectedSlotId }),
      });
      if (response.ok) {
        // Find the chosen slot and show finalized view immediately
        const chosen = (fetchedData?.suggestedDates || []).find((s) => s.id === selectedSlotId);
        setFinalSlot(chosen || null);
        setIsFinalized(true);
      } else {
        setNotice({ type: "error", message: "Napaka na strežniku pri zaključevanju glasovanja." });
      }
    } catch {
      setNotice({ type: "error", message: "Omrežna napaka pri zaključevanju." });
    } finally {
      setIsSubmitting(false);
    }
  };

  let error = apiError;
  if (!propEventData && !basicToken) error = "Napačna skrbniška povezava. Manjka identifikator povabila.";
  const loading = !propEventData && !error && (apiLoading || (!fetchedData && !isFinalized));

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-sm" style={{ color: "var(--color-text)", opacity: 0.4 }}>
        Nalagam administratorske podatke...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-center px-4">
        <h2 className="text-xl font-medium mb-2" style={{ color: "var(--color-text)" }}>Napaka pri dostopu</h2>
        <p className="text-sm max-w-sm" style={{ color: "var(--color-text)", opacity: 0.55 }}>{error}</p>
      </div>
    );
  }

  // Show finalized state for admin
  if (isFinalized) {
    const data = propEventData || fetchedData;
    return (
      <FinalizedView
        title={data?.title}
        description={data?.description}
        finalSlot={finalSlot}
        isAdmin={true}
      />
    );
  }

  const eventData = propEventData || fetchedData;
  const { title, description, suggestedDates = [], votes = [] } = eventData || {};
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  return (
    <div className="min-h-screen py-14 md:py-20 px-4" style={{ backgroundColor: "var(--color-bg)" }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-medium mb-5 transition-opacity hover:opacity-60"
              style={{ color: "var(--color-primary)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Nazaj
            </button>
          )}

          <p
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: "var(--color-primary)", opacity: 0.5 }}
          >
            Skrbniški pogled
          </p>

          <h1
            className="text-4xl md:text-5xl leading-tight mb-3"
            style={{ color: "var(--color-text)", fontFamily: "'Georgia', serif", fontWeight: 400 }}
          >
            {title}
          </h1>

          {description && (
            <p
              className="text-sm leading-relaxed mt-1"
              style={{ color: "var(--color-text)", opacity: 0.5 }}
            >
              {description}
            </p>
          )}

          <div className="mt-6 h-px w-12" style={{ backgroundColor: "var(--color-accent-2)" }} />
        </div>

        {/* Notice */}
        {notice && (
          <div
            ref={noticeRef}
            className="mb-6 rounded-xl px-4 py-3 text-sm"
            style={
              notice.type === "error"
                ? { backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c" }
                : {
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))",
                    border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
                    color: "var(--color-primary)",
                  }
            }
          >
            {notice.message}
          </div>
        )}

        {/* Suggestions section */}
        {pendingSuggestions.length > 0 && (
          <div
            className="mb-8 rounded-xl p-5"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary) 4%, var(--color-bg))",
              border: "1.5px solid var(--color-accent-2)",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: "var(--color-accent-2)" }}
              />
              <h2
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-text)", opacity: 0.6 }}
              >
                Predlogi udeležencev
                <span className="ml-1.5 font-bold" style={{ color: "var(--color-primary)" }}>
                  ({pendingSuggestions.length})
                </span>
              </h2>
            </div>
            <p className="text-xs mb-4 pl-4" style={{ color: "var(--color-text)", opacity: 0.45 }}>
              Kliknite na datum za sprejem ali zavrnitev predloga.
            </p>

            <CalendarPicker
              selectedDates={pendingSuggestions.map((s) => ({
                id: s.id,
                date: s.start_time.split("T")[0],
                start_time: s.start_time,
                end_time: s.end_time,
              }))}
              suggestions={pendingSuggestions.map((s) => ({
                id: s.id,
                date: s.start_time.split("T")[0],
                suggested_by: s.suggested_by,
                start_time: s.start_time,
              }))}
              onSuggestionSelect={(date, dateSuggestions) => setPendingSuggestion(dateSuggestions[0])}
            />

            {pendingSuggestion && (
              <div
                className="mt-4 p-4 rounded-xl"
                style={{
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)",
                }}
              >
                <p className="text-sm mb-3" style={{ color: "var(--color-text)" }}>
                  Predlog od{" "}
                  <span className="font-semibold">{pendingSuggestion.suggested_by}</span>:{" "}
                  <span style={{ color: "var(--color-primary)" }}>
                    {formatSuggestionTime(pendingSuggestion.start_time)}
                  </span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSuggestionAction(pendingSuggestion.id, "accept")}
                    className="text-xs font-medium px-4 py-2 rounded-lg transition-all hover:opacity-90"
                    style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
                  >
                    Sprejmi → dodaj v poll
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSuggestionAction(pendingSuggestion.id, "reject")}
                    className="text-xs font-medium px-4 py-2 rounded-lg border transition-all hover:opacity-70"
                    style={{
                      borderColor: "color-mix(in srgb, var(--color-primary) 20%, transparent)",
                      color: "var(--color-text)",
                      backgroundColor: "transparent",
                    }}
                  >
                    Zavrni
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingSuggestion(null)}
                    className="text-xs px-2 py-2 rounded-lg transition-all hover:opacity-50"
                    style={{ color: "var(--color-text)", opacity: 0.35 }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Finalize form */}
        <form onSubmit={handleFinalize} className="space-y-6">
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--color-text)", opacity: 0.45 }}
            >
              Rezultati glasovanja
            </label>
            <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.4 }}>
              Preglejte odgovore in izberite končni potrjeni termin.
            </p>
          </div>

          <div className="space-y-2">
            {suggestedDates.map((slot) => {
              const isChecked = selectedSlotId === slot.id;
              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: isChecked
                      ? "1.5px solid var(--color-primary)"
                      : "1.5px solid color-mix(in srgb, var(--color-primary) 12%, transparent)",
                    backgroundColor: isChecked
                      ? "color-mix(in srgb, var(--color-primary) 5%, var(--color-bg))"
                      : "transparent",
                  }}
                >
                  <div className="pt-4 pl-1 flex-shrink-0">
                    <div
                      className="rounded-full flex items-center justify-center transition-all"
                      style={{
                        width: "18px",
                        height: "18px",
                        border: isChecked
                          ? "2px solid var(--color-primary)"
                          : "2px solid color-mix(in srgb, var(--color-primary) 30%, transparent)",
                        backgroundColor: isChecked ? "var(--color-primary)" : "transparent",
                      }}
                    >
                      {isChecked && (
                        <div
                          className="rounded-full"
                          style={{ width: "6px", height: "6px", backgroundColor: "var(--color-on-primary)" }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 pointer-events-none">
                    <VoteResults suggestedDates={[slot]} votes={votes} />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="rounded-xl px-4 py-3.5 text-xs leading-relaxed"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary) 5%, var(--color-bg))",
              border: "1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)",
              color: "var(--color-text)",
              opacity: 0.7,
            }}
          >
            <strong style={{ opacity: 1 }}>Opozorilo:</strong> Izbira in potrditev termina bosta trajno
            zaključili glasovanje. Sistem bo samodejno poslal obvestila z datoteko koledarja vsem
            prijavljenim udeležencem.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-6 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:scale-100"
            style={{ backgroundColor: "var(--color-primary)", color: "var(--color-on-primary)" }}
          >
            {isSubmitting ? "Zaklujem glasovanje..." : "Potrdi izbran termin in obvesti vse"}
          </button>
        </form>
      </div>
    </div>
  );
}