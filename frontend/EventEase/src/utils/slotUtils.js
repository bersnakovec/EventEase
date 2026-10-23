export const DEFAULT_TIME = "12:00";
export const DEFAULT_SLOT_MINUTES = 60;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function splitDateTime(value) {
  return value.includes("T") ? value.split("T") : value.split(" ");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Vrne datum (YYYY-MM-DD) iz niza ali objekta termina ({ date } ali { start_time }). */
export function getDateStr(item) {
  if (!item) return "";
  if (typeof item === "string") return splitDateTime(item)[0];
  if (item.date) return item.date;
  if (item.start_time) return splitDateTime(item.start_time)[0];
  return "";
}

/** Vrne uro (HH:MM) termina; če ura ni podana, vrne privzeto uro 12:00. */
export function getTimeStr(item) {
  if (!item) return "";
  if (item.time) return item.time;
  if (item.start_time) {
    const timePart = splitDateTime(item.start_time)[1];
    if (timePart) return timePart.substring(0, 5);
  }
  return DEFAULT_TIME;
}

/** Ključ, pod katerim je shranjen glas za termin: id termina, sicer datum. */
export function getVoteKey(item) {
  return item?.id || getDateStr(item);
}

/** Združi termine po datumu; termini brez datuma se izpustijo. */
export function groupByDate(items = []) {
  return items.reduce((acc, item) => {
    const dateStr = getDateStr(item);
    if (!dateStr) return acc;
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(item);
    return acc;
  }, {});
}

/**
 * Cikel glasovanja s klikom: ne → da → če bo potrebno → ne.
 * Backendna vrednost "if_need_be" je enakovredna "if_needed"; neznan status pomeni "ne".
 */
export function nextVoteStatus(currentStatus) {
  if (currentStatus === "yes") return "if_needed";
  if (currentStatus === "if_needed" || currentStatus === "if_need_be") return "no";
  return "yes";
}

/** Vrne nov objekt statusov; status "no" (ali prazen) ključ odstrani. Vhoda ne spreminja. */
export function applyVoteStatus(statuses, key, nextStatus) {
  const updated = { ...statuses };
  if (!nextStatus || nextStatus === "no") {
    delete updated[key];
  } else {
    updated[key] = nextStatus;
  }
  return updated;
}

/**
 * Premakne glas za termin na naslednji status in o tem obvesti onChange.
 * Vrne true, če je bil onChange poklican.
 */
export function cycleVoteStatus(item, statuses, onChange) {
  if (typeof onChange !== "function") return false;
  const key = getVoteKey(item);
  if (!key) return false;
  const next = nextVoteStatus(statuses[key]);
  onChange(applyVoteStatus(statuses, key, next));
  return true;
}

/**
 * Pretvori izbrani datum in uro v termin za backend.
 * Konec je durationMinutes po začetku; prehod čez polnoč premakne datum konca.
 */
export function formatBackendSlot(dateStr, timeStr, durationMinutes = DEFAULT_SLOT_MINUTES) {
  const dateMatch = DATE_RE.exec(dateStr ?? "");
  if (!dateMatch) throw new TypeError(`Invalid date (expected YYYY-MM-DD): ${dateStr}`);
  const timeMatch = TIME_RE.exec(timeStr ?? "");
  if (!timeMatch) throw new TypeError(`Invalid time (expected HH:MM): ${timeStr}`);
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError(`Duration must be a positive integer, got: ${durationMinutes}`);
  }

  const [, y, mo, d] = dateMatch.map(Number);
  const [, h, mi] = timeMatch.map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (start.getUTCMonth() !== mo - 1 || start.getUTCDate() !== d) {
    throw new TypeError(`Invalid calendar date: ${dateStr}`);
  }
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  return {
    start_time: `${dateStr}T${timeStr}:00`,
    end_time: `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-${pad2(end.getUTCDate())}T${pad2(end.getUTCHours())}:${pad2(end.getUTCMinutes())}:00`,
  };
}

/** Lokalni koledarski datum (YYYY-MM-DD) – ne UTC, kot bi ga dal toISOString(). */
export function toLocalISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Ali je datum pred današnjim lokalnim dnem. */
export function isPastDate(dateStr, now = new Date()) {
  return dateStr < toLocalISODate(now);
}
