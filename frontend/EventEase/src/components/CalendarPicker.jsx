import { useState } from "react";
import {
  getDateStr,
  getTimeStr,
  getVoteKey,
  groupByDate,
  applyVoteStatus,
  cycleVoteStatus as cycleStatus,
  formatBackendSlot,
  toLocalISODate,
} from "../utils/slotUtils.js";

export default function CalendarPicker({
  selectedDates = [],
  onChange,
  dateStatuses = {},
  onDateStatusesChange,
  isPollMode = false,
  allowedDates = null,
  suggestions = [],
  onSuggestionSelect,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeDateStr, setActiveDateStr] = useState(null);
  const [expandedDateStr, setExpandedDateStr] = useState(null);
  const [lastSelectedTime, setLastSelectedTime] = useState("12:00");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayISO = toLocalISODate();

  const monthNames = [
    "Januar", "Februar", "Marec", "April", "Maj", "Junij",
    "Julij", "Avgust", "September", "Oktober", "November", "December",
  ];

  const weekDays = ["Po", "To", "Sr", "Če", "Pe", "So", "Ne"];

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const blankCells = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const selectedDateStrings = selectedDates.map(getDateStr);
  const groupedSelectedDates = groupByDate(selectedDates);
  const groupedSuggestions = groupByDate(suggestions);

  const getTimeLabel = (item) => {
    return getTimeStr(item);
  };

  const setVoteStatus = (item, nextStatus) => {
    if (!onDateStatusesChange) return;
    const key = getVoteKey(item);
    if (!key) return;
    onDateStatusesChange(applyVoteStatus(dateStatuses, key, nextStatus));
  };

  const cycleVoteStatus = (item) => {
    cycleStatus(item, dateStatuses, onDateStatusesChange);
  };

  const voteStatusLabel = (status) => {
    if (status === "yes") return "Da";
    if (status === "if_needed") return "Če bo potrebno";
    return "Ne";
  };

  const voteStatusStyles = {
    yes: "bg-green-500 text-white hover:bg-green-600",
    if_needed: "bg-yellow-400 text-gray-900 hover:bg-yellow-500",
    no: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
  };

  const handleDateClick = (day, dayItems = []) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateSuggestionItems = groupedSuggestions[dateStr] || [];
    if (dateStr < todayISO) return; // disallow past dates
    if (allowedDates && !allowedDates.includes(dateStr)) return;

    if (isPollMode && allowedDates) {
      if (dayItems.length > 1) {
        setExpandedDateStr((current) => (current === dateStr ? null : dateStr));
        return;
      }

      const matchedSlot = dayItems[0] || selectedDates.find((d) => getDateStr(d) === dateStr);
      if (!matchedSlot) return;

      cycleVoteStatus(matchedSlot);
      setExpandedDateStr(null);
      return;
    }

    if (isPollMode) {
      const updatedDates = selectedDateStrings.includes(dateStr)
        ? selectedDates.filter((d) => getDateStr(d) !== dateStr)
        : [...selectedDates, formatBackendSlot(dateStr, lastSelectedTime)];

      if (onChange) onChange(updatedDates);
      if (expandedDateStr === dateStr) setExpandedDateStr(null);
      setActiveDateStr(selectedDateStrings.includes(dateStr) ? null : dateStr);
      return;
    }

    if (allowedDates) {
      const matchedSlot = selectedDates.find((d) => getDateStr(d) === dateStr);
      cycleVoteStatus(matchedSlot || dateStr);
      return;
    }

    if (dateSuggestionItems.length > 1) {
      setExpandedDateStr((current) => (current === dateStr ? null : dateStr));
      return;
    }

    const existingIndex = selectedDates.findIndex((d) => getDateStr(d) === dateStr);

    if (existingIndex !== -1) {
      const updatedDates = selectedDates.filter((_, index) => index !== existingIndex);
      if (onChange) onChange(updatedDates);
      if (activeDateStr === dateStr) setActiveDateStr(null);
    } else {
      const newSlot = formatBackendSlot(dateStr, lastSelectedTime);
      const updatedDates = [...selectedDates, newSlot];
      if (onChange) onChange(updatedDates);
      setActiveDateStr(dateStr);
    }
  };

  const handleTimeChange = (dateStr, newTime) => {
    if (!newTime) return; // cleared <input type="time">
    setLastSelectedTime(newTime);
    const activeIndex = selectedDates.findIndex((d) => getDateStr(d) === dateStr);
    if (activeIndex === -1) return;

    const currentDateStr = getDateStr(selectedDates[activeIndex]);
    const nextSlot = formatBackendSlot(currentDateStr, newTime);
    const updatedDates = selectedDates.map((d, index) => (
      index === activeIndex ? nextSlot : d
    ));

    if (onChange) onChange(updatedDates);
    setActiveDateStr(currentDateStr);
  };

  const days = [];
  for (let i = 0; i < blankCells; i++) days.push({ type: "blank", val: i });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isPast = dateKey < todayISO;
    const dateSuggestions = groupedSuggestions[dateKey] || [];
    const dateSlots = groupedSelectedDates[dateKey] || [];
    const isSuggested = dateSuggestions.length > 0;
    const isExpanded = expandedDateStr === dateKey;
    const selectedSlotCount = dateSlots.length;

    let stateStyles = "hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--color-text)]";

    if (isPast) {
      stateStyles = "text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-40";
    } else if (allowedDates) {
      if (!allowedDates.includes(dateKey)) {
        stateStyles = "text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-40";
      } else {
        const activeStatuses = dateSlots
          .map((slot) => dateStatuses[getVoteKey(slot)] || "no")
          .filter((status) => status !== "no");
        if (activeStatuses.includes("yes")) {
          stateStyles = "bg-green-500 text-white font-medium hover:bg-green-600";
        } else if (activeStatuses.includes("if_needed")) {
          stateStyles = "bg-yellow-400 text-gray-900 font-semibold hover:bg-yellow-500";
        } else {
          stateStyles = "bg-red-500 text-white font-medium hover:bg-red-600";
        }
      }
    } else if (selectedDateStrings.includes(dateKey)) {
      stateStyles = isExpanded
        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium ring-2 ring-offset-1 ring-[var(--color-primary)]"
        : "bg-[var(--color-primary)] text-[var(--color-on-primary)] font-medium hover:opacity-95 ring-2 ring-offset-1 ring-[var(--color-primary)]";
    } else if (isSuggested) {
      stateStyles = "ring-2 ring-[var(--color-accent-1)] text-[var(--color-text)] hover:bg-[var(--color-accent-1)]/20";
    }

    days.push({
      type: "day",
      val: d,
      key: dateKey,
      stateStyles,
      isPast,
      isSuggested,
      dateSuggestions,
      dateSlots,
      isExpanded,
      selectedSlotCount,
    });
  }

  const activeSelection = selectedDates.find((d) => getDateStr(d) === activeDateStr);
  const activeTimeValue = activeSelection
    ? getTimeStr(activeSelection)
    : lastSelectedTime;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 w-full max-w-sm mx-auto shadow-sm transition-all duration-200">
      {/* Month Navigation with accent-2 hover */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          className="p-1.5 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-[var(--color-accent-1)]/20 hover:text-[var(--color-primary)] hover:border-[var(--color-accent-1)] transition"
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
        >
          &larr;
        </button>
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          className="p-1.5 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-[var(--color-accent-1)]/20 hover:text-[var(--color-primary)] hover:border-[var(--color-accent-1)] transition"
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
        >
          &rarr;
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">
        {weekDays.map((wd) => (
          <span key={wd}>{wd}</span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((item) => {
          const matchedItems = item.dateSlots || [];
          const displayTime = matchedItems.length === 1 ? getTimeLabel(matchedItems[0]) : "";
          const displayCount = matchedItems.length > 1 ? `+${matchedItems.length}` : "";

          return item.type === "blank" ? (
            <span key={`b-${item.val}`} className="aspect-square" />
          ) : (
            <div key={item.key} className="relative group">
              <button
                type="button"
                className={`aspect-square rounded-lg text-sm transition flex flex-col items-center justify-center w-full relative ${item.stateStyles}`}
                onClick={() => {
                  if (item.isPast) return;
                  if (item.isSuggested && onSuggestionSelect && !isPollMode && item.dateSuggestions.length <= 1) {
                    onSuggestionSelect(item.key, item.dateSuggestions);
                    return;
                  }
                  handleDateClick(item.val, item.dateSlots);
                }}
              >
                <span>{item.val}</span>
                {selectedDateStrings.includes(item.key) && (
                  <span className="text-[9px] opacity-80 block -mt-0.5 font-light">
                    {displayCount || displayTime}
                  </span>
                )}
              </button>

              {item.isSuggested && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 hidden group-hover:block w-max max-w-[140px]">
                  <div className="bg-gray-900 dark:bg-gray-700 text-white text-[10px] rounded px-2 py-1 leading-snug shadow-md border border-[var(--color-accent-1)]">
                    {item.dateSuggestions.map((s) => s.suggested_by).join(", ")}
                  </div>
                </div>
              )}

              {item.isExpanded && !isPollMode && item.dateSuggestions.length > 1 && (
                <div className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-lg text-left">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                        Predlogi terminov
                      </p>
                      <p className="text-xs font-medium text-[var(--color-text)]">
                        {item.key.split("-")[2]}. {monthNames[month]}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 text-gray-500 hover:text-[var(--color-text)] hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedDateStr(null);
                      }}
                    >
                      Zapri
                    </button>
                  </div>

                  <div className="space-y-2">
                    {item.dateSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id || `${item.key}-${suggestion.suggested_by}`}
                        type="button"
                        className="w-full rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 px-3 py-2 text-left transition hover:border-[var(--color-accent-1)] hover:bg-[var(--color-accent-1)]/10"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSuggestionSelect?.(item.key, item.dateSuggestions, suggestion);
                          setExpandedDateStr(null);
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text)]">
                              {getTimeLabel(suggestion)}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {suggestion.suggested_by}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                            Izberi
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {item.isExpanded && isPollMode && item.dateSlots.length > 0 && (
                <div className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-lg text-left">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                        Možni termini
                      </p>
                      <p className="text-xs font-medium text-[var(--color-text)]">
                        {item.key.split("-")[2]}. {monthNames[month]}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-[10px] font-medium px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 text-gray-500 hover:text-[var(--color-text)] hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedDateStr(null);
                      }}
                    >
                      Zapri
                    </button>
                  </div>

                  <div className="space-y-2">
                    {item.dateSlots.map((slot) => {
                      const slotKey = getVoteKey(slot);
                      const currentStatus = dateStatuses[slotKey] || "no";
                      return (
                        <div
                          key={slotKey}
                          className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 px-2.5 py-2"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text)] truncate">
                                {getTimeLabel(slot)}
                              </p>
                              {slot.end_time && (
                                <p className="text-[10px] text-gray-400">
                                  {slot.end_time.includes("T")
                                    ? slot.end_time.split("T")[0]
                                    : slot.end_time.split(" ")[0]}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              {voteStatusLabel(currentStatus)}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1">
                            {[
                              ["yes", "Da"],
                              ["if_needed", "Če bo potrebno"],
                              ["no", "Ne"],
                            ].map(([status, label]) => (
                              <button
                                key={status}
                                type="button"
                                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${voteStatusStyles[status]}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setVoteStatus(slot, status);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline Time Picker with accent-2 focus ring */}
      {activeSelection && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
              Izbrana ura za
            </p>
            <p className="text-xs font-semibold text-[var(--color-text)]">
              {getDateStr(activeSelection).split("-")[2]}.{" "}
              {monthNames[parseInt(getDateStr(activeSelection).split("-")[1]) - 1]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="time"
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1 text-sm font-medium text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-2)] focus:border-transparent transition"
              value={activeTimeValue}
              onChange={(e) => handleTimeChange(activeDateStr, e.target.value)}
            />
            <button
              type="button"
              className="text-xs bg-[var(--color-primary)] text-[var(--color-on-primary)] px-2.5 py-1.5 rounded-lg font-medium hover:bg-[var(--color-accent-3)] transition"
              onClick={() => setActiveDateStr(null)}
            >
              Potrdi
            </button>
          </div>
        </div>
      )}

      {isPollMode && (
        <div className="text-xs text-[var(--color-text)]/80 mt-3 font-light space-y-1">
          {allowedDates ? (
            <div className="flex justify-center gap-4 border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-red-500" />
                Ne
              </p>
              <p className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-green-500" />
                Da
              </p>
              <p className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-yellow-400" />
                Če bo potrebno
              </p>
            </div>
          ) : (
            <p className="text-center border-t border-gray-100 dark:border-gray-800 pt-3">
              Izberete lahko več datumov za glasovanje.
            </p>
          )}
        </div>
      )}
    </div>
  );
}