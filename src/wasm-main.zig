const std = @import("std");
const Genome = @import("./genome.zig").Genome;
const Gene = @import("./genome.zig").Gene;
const randomGenome = @import("./genome.zig").randomGenome;
const Individual = @import("./individual.zig");
const World = @import("./world.zig");

extern "debug" fn js_err(ptr: [*]const u8, len: usize) void;
extern "debug" fn js_log(ptr: [*]const u8, len: usize) void;
extern "debug" fn log_write(ptr: [*]const u8, len: usize) void;

var logging_allocator = std.heap.logToWriterAllocator(std.heap.page_allocator, JSDebug.writer);
var allocator = &logging_allocator.allocator;
var arena_allocator = std.heap.ArenaAllocator.init(&logging_allocator.allocator);

const JSDebug = struct {
    pub const Context = struct {
        write_fn: fn ([*]const u8, usize) callconv(.C) void,
    };

    pub const WriteError = error{};

    pub const Writer = std.io.Writer(Context, WriteError, write);

    pub const writer = Writer{ .context = .{ .write_fn = log_write } };

    fn write(context: Context, bytes: []const u8) WriteError!usize {
        context.write_fn(bytes.ptr, bytes.len);
        return bytes.len;
    }
};

pub fn panic(err: []const u8, maybe_trace: ?*std.builtin.StackTrace) noreturn {
    _ = maybe_trace;
    js_err(err.ptr, err.len);
    while (true) @breakpoint();
}

// This is partially copied from the default log implementation in the standard library.
pub fn log(
    comptime level: std.log.Level,
    comptime scope: @TypeOf(.EnumLiteral),
    comptime fmt: []const u8,
    args: anytype,
) void {
    const level_txt = switch (level) {
        .err => "error",
        .warn => "warning",
        .info => "info",
        .debug => "debug",
    };
    const prefix2 = if (scope == .default) ": " else "(" ++ @tagName(scope) ++ "): ";
    const format = level_txt ++ prefix2 ++ fmt;
    const log_allocator = std.heap.page_allocator;

    const log_buffer = std.fmt.allocPrint(log_allocator, format, args) catch |err| {
        const err_msg = @errorName(err);
        const msg = "Failed to format log message";
        js_err(msg, msg.len);
        js_err(@ptrCast([*]const u8, err_msg), err_msg.len);
        return;
    };

    defer log_allocator.free(log_buffer);

    js_log(log_buffer.ptr, log_buffer.len);
    JSDebug.writer.writeAll(log_buffer) catch unreachable;
    JSDebug.writer.writeByte('\n') catch unreachable;
}

export fn allocBuffer(size: usize) [*]u8 {
    const buf = allocator.alloc(u8, size) catch unreachable;
    return buf.ptr;
}

export fn freeBuffer(ptr: [*]u8, len: usize) void {
    const buf = ptr[0..len];
    allocator.free(buf);
}

var world: World = undefined;

export fn initWorld(w: f32, h: f32, seed: u32, count: usize) void {
    var isaac = std.rand.Isaac64.init(@intCast(u64, seed));
    var rand = isaac.random();

    world = World.init(&arena_allocator.allocator, w, h);
    world.populateRandomly(&rand, count) catch unreachable;

    const indiv = world.individuals.items[0];

    for (indiv.genome.items) |gene| std.log.debug("{}", .{gene});
}

export fn stepWorld() void {
    world.step();
}

export fn serializeWorld(buffer: [*]u8, len: usize) usize {
    var stream = std.io.FixedBufferStream([]u8){
        .buffer = buffer[0..len],
        .pos = 0,
    };
    var writer = stream.writer();

    world.writeTo(writer) catch unreachable;

    return stream.pos;
}
