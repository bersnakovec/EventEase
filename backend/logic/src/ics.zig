const std = @import("std");

// ----------------------------------------------------------------------------
// iCalendar (RFC 5545) helpers
// ----------------------------------------------------------------------------

pub const IcsError = error{ InvalidTimestamp, InvalidTimeRange };

/// Length of a UTC iCalendar timestamp: "YYYYMMDDTHHMMSSZ".
pub const timestamp_len = 16;

const seconds_per_day = 86_400;

fn isLeapYear(year: i64) bool {
    return (@mod(year, 4) == 0 and @mod(year, 100) != 0) or @mod(year, 400) == 0;
}

fn daysInMonth(year: i64, month: u8) u8 {
    return switch (month) {
        1, 3, 5, 7, 8, 10, 12 => 31,
        4, 6, 9, 11 => 30,
        2 => if (isLeapYear(year)) 29 else 28,
        else => 0,
    };
}

// Howard Hinnant's days_from_civil / civil_from_days.
fn daysFromCivil(year: i64, month: u8, day: u8) i64 {
    const y = if (month <= 2) year - 1 else year;
    const era = @divFloor(y, 400);
    const yoe = y - era * 400;
    const m: i64 = month;
    const mp = if (m > 2) m - 3 else m + 9;
    const doy = @divFloor(153 * mp + 2, 5) + day - 1;
    const doe = yoe * 365 + @divFloor(yoe, 4) - @divFloor(yoe, 100) + doy;
    return era * 146_097 + doe - 719_468;
}

const Civil = struct { year: i64, month: u8, day: u8 };

fn civilFromDays(days: i64) Civil {
    const z = days + 719_468;
    const era = @divFloor(z, 146_097);
    const doe = z - era * 146_097;
    const yoe = @divFloor(doe - @divFloor(doe, 1460) + @divFloor(doe, 36_524) - @divFloor(doe, 146_096), 365);
    const doy = doe - (365 * yoe + @divFloor(yoe, 4) - @divFloor(yoe, 100));
    const mp = @divFloor(5 * doy + 2, 153);
    const day: u8 = @intCast(doy - @divFloor(153 * mp + 2, 5) + 1);
    const month: u8 = @intCast(if (mp < 10) mp + 3 else mp - 9);
    return .{ .year = yoe + era * 400 + @as(i64, if (month <= 2) 1 else 0), .month = month, .day = day };
}

fn parseDigits(s: []const u8, start: usize, len: usize) IcsError!u32 {
    if (start + len > s.len) return error.InvalidTimestamp;
    var value: u32 = 0;
    for (s[start .. start + len]) |c| {
        if (c < '0' or c > '9') return error.InvalidTimestamp;
        value = value * 10 + (c - '0');
    }
    return value;
}

fn expectChar(s: []const u8, i: usize, c: u8) IcsError!void {
    if (i >= s.len or s[i] != c) return error.InvalidTimestamp;
}

/// Parses an ISO 8601 or PostgreSQL `timestamptz::text` value into Unix seconds (UTC).
///
/// Accepted: `YYYY-MM-DD[T| ]HH:MM[:SS[.fraction]][Z|±HH[[:]MM]]`.
/// Without an offset the value is taken as UTC.
pub fn parseTimestamp(ts: []const u8) IcsError!i64 {
    const year = try parseDigits(ts, 0, 4);
    try expectChar(ts, 4, '-');
    const month = try parseDigits(ts, 5, 2);
    try expectChar(ts, 7, '-');
    const day = try parseDigits(ts, 8, 2);
    if (ts.len <= 10 or (ts[10] != 'T' and ts[10] != ' ')) return error.InvalidTimestamp;
    const hour = try parseDigits(ts, 11, 2);
    try expectChar(ts, 13, ':');
    const minute = try parseDigits(ts, 14, 2);

    var i: usize = 16;
    var second: u32 = 0;
    if (i < ts.len and ts[i] == ':') {
        second = try parseDigits(ts, i + 1, 2);
        i += 3;
        if (i < ts.len and ts[i] == '.') {
            i += 1;
            const frac_start = i;
            while (i < ts.len and ts[i] >= '0' and ts[i] <= '9') i += 1;
            if (i == frac_start) return error.InvalidTimestamp;
        }
    }

    if (month < 1 or month > 12) return error.InvalidTimestamp;
    if (day < 1 or day > daysInMonth(year, @intCast(month))) return error.InvalidTimestamp;
    if (hour > 23 or minute > 59 or second > 59) return error.InvalidTimestamp;

    var offset_seconds: i64 = 0;
    if (i < ts.len) {
        switch (ts[i]) {
            'Z' => i += 1,
            '+', '-' => {
                const sign: i64 = if (ts[i] == '-') -1 else 1;
                const off_h = try parseDigits(ts, i + 1, 2);
                i += 3;
                var off_m: u32 = 0;
                if (i < ts.len) {
                    if (ts[i] == ':') i += 1;
                    off_m = try parseDigits(ts, i, 2);
                    i += 2;
                }
                if (off_h > 23 or off_m > 59) return error.InvalidTimestamp;
                offset_seconds = sign * (@as(i64, off_h) * 3600 + @as(i64, off_m) * 60);
            },
            else => return error.InvalidTimestamp,
        }
    }
    if (i != ts.len) return error.InvalidTimestamp;

    const days = daysFromCivil(year, @intCast(month), @intCast(day));
    const local_seconds = days * seconds_per_day + @as(i64, hour) * 3600 + @as(i64, minute) * 60 + second;
    return local_seconds - offset_seconds;
}

/// Formats Unix seconds as a UTC iCalendar timestamp ("YYYYMMDDTHHMMSSZ").
pub fn formatUnixUtc(buf: *[timestamp_len]u8, unix_seconds: i64) IcsError![]const u8 {
    const days = @divFloor(unix_seconds, seconds_per_day);
    const secs_of_day: u32 = @intCast(@mod(unix_seconds, seconds_per_day));
    const civil = civilFromDays(days);
    if (civil.year < 0 or civil.year > 9999) return error.InvalidTimestamp;
    return std.fmt.bufPrint(buf, "{d:0>4}{d:0>2}{d:0>2}T{d:0>2}{d:0>2}{d:0>2}Z", .{
        @as(u32, @intCast(civil.year)), civil.month,           civil.day,
        secs_of_day / 3600,             (secs_of_day / 60) % 60, secs_of_day % 60,
    }) catch unreachable;
}

/// Converts e.g. "2024-06-15 14:00:00+02" → "20240615T120000Z".
pub fn formatIcsTimestamp(buf: *[timestamp_len]u8, ts: []const u8) IcsError![]const u8 {
    return formatUnixUtc(buf, try parseTimestamp(ts));
}

/// Escapes TEXT values (RFC 5545, 3.3.11): backslash, semicolon, comma and newlines.
pub fn escapeText(alloc: std.mem.Allocator, text: []const u8) ![]u8 {
    var out = std.ArrayListUnmanaged(u8).empty;
    errdefer out.deinit(alloc);
    for (text) |c| {
        switch (c) {
            '\\' => try out.appendSlice(alloc, "\\\\"),
            ';' => try out.appendSlice(alloc, "\\;"),
            ',' => try out.appendSlice(alloc, "\\,"),
            '\n' => try out.appendSlice(alloc, "\\n"),
            '\r' => {},
            else => try out.append(alloc, c),
        }
    }
    return out.toOwnedSlice(alloc);
}

/// Builds a single-event iCalendar file with CRLF line endings.
/// `dtstamp_unix` is the creation time (injected so the output is deterministic in tests).
pub fn buildIcsContent(
    alloc: std.mem.Allocator,
    poll_title: []const u8,
    start_time: []const u8,
    end_time: []const u8,
    dtstamp_unix: i64,
) ![]u8 {
    const start = try parseTimestamp(start_time);
    const end = try parseTimestamp(end_time);
    if (end <= start) return error.InvalidTimeRange;

    var start_buf: [timestamp_len]u8 = undefined;
    var end_buf: [timestamp_len]u8 = undefined;
    var stamp_buf: [timestamp_len]u8 = undefined;
    const start_ics = try formatUnixUtc(&start_buf, start);
    const end_ics = try formatUnixUtc(&end_buf, end);
    const stamp_ics = try formatUnixUtc(&stamp_buf, dtstamp_unix);

    const summary = try escapeText(alloc, poll_title);
    defer alloc.free(summary);

    return std.fmt.allocPrint(alloc, "BEGIN:VCALENDAR\r\n" ++
        "VERSION:2.0\r\n" ++
        "PRODID:-//EventEase//Poll//EN\r\n" ++
        "METHOD:REQUEST\r\n" ++
        "BEGIN:VEVENT\r\n" ++
        "UID:{s}-{x:0>16}@eventease\r\n" ++
        "DTSTAMP:{s}\r\n" ++
        "DTSTART:{s}\r\n" ++
        "DTEND:{s}\r\n" ++
        "SUMMARY:{s}\r\n" ++
        "DESCRIPTION:This event was scheduled via a poll.\r\n" ++
        "END:VEVENT\r\n" ++
        "END:VCALENDAR\r\n", .{
        start_ics, std.hash.Wyhash.hash(0, poll_title), stamp_ics, start_ics, end_ics, summary,
    });
}

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
