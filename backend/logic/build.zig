const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const httpz = b.dependency("httpz", .{}).module("httpz");
    const pg_module = b.dependency("pg", .{}).module("pg");

    const exe = b.addExecutable(.{
        .name = "logic",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "pg", .module = pg_module },
                .{ .name = "httpz", .module = httpz },
            },
        }),
    });

    b.installArtifact(exe);

    const run_step = b.step("run", "Run the app");
    const run_cmd = b.addRunArtifact(exe);
    run_step.dependOn(&run_cmd.step);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    // Unit tests: modules that depend only on std (no DB / HTTP).
    // `-Dtest-filter=...` narrows the run, the `test-bin` step installs the
    // test binaries to zig-out/bin so CI can run them under kcov for coverage.
    const test_filters = b.option([]const []const u8, "test-filter", "Skip tests that do not match the filter") orelse &.{};
    const test_step = b.step("test", "Run unit tests");
    const test_bin_step = b.step("test-bin", "Install unit test binaries (for coverage)");

    const test_sources = [_][]const u8{ "uuid", "ics" };
    for (test_sources) |name| {
        const unit_tests = b.addTest(.{
            .name = b.fmt("{s}-tests", .{name}),
            .root_module = b.createModule(.{
                .root_source_file = b.path(b.fmt("src/{s}.zig", .{name})),
                .target = target,
                .optimize = optimize,
            }),
            .filters = test_filters,
            // LLVM backend emits full DWARF line info, which kcov needs.
            .use_llvm = true,
        });
        test_step.dependOn(&b.addRunArtifact(unit_tests).step);
        test_bin_step.dependOn(&b.addInstallArtifact(unit_tests, .{}).step);
    }
}
