const std = @import("std");
const Individual = @import("./individual.zig");
const Vec2 = @import("./vec2.zig");
const randomGenome = @import("./genome.zig").randomGenome;

const Self = @This();

allocator: *std.mem.Allocator,
width: f32,
height: f32,
individuals: std.ArrayList(Individual),

pub fn init(allocator: *std.mem.Allocator, w: f32, h: f32) Self {
    return Self{
        .allocator = allocator,
        .width = w,
        .height = h,
        .individuals = std.ArrayList(Individual).init(allocator),
    };
}

pub fn populateRandomly(self: *Self, rand: *std.rand.Random, count: usize) !void {
    try self.individuals.ensureTotalCapacity(count);
    self.individuals.clearRetainingCapacity();

    std.log.debug("Spawning {} random individuals", .{count});

    var i = count;

    while (i > 0) : (i -= 1) {
        self.individuals.appendAssumeCapacity(.{
            .location = .{
                .x = rand.float(f32) * self.width,
                .y = rand.float(f32) * self.height,
            },
            .rotation = rand.float(f32) * 2 * std.math.pi,
            .genome = try randomGenome(self.allocator, rand, 5),
        });
    }
}

pub fn writeTo(self: Self, writer: anytype) !void {
    try writer.writeIntBig(u32, self.individuals.items.len);
    for (self.individuals.items) |indiv| try indiv.writeTo(writer);
}

pub fn step(self: *Self) void {
    for (self.individuals.items) |*indiv| {
        const mv = Vec2{ .x = 1, .y = 0 };
        const add = mv.rotate(indiv.rotation).scale(0.1);
        indiv.rotation += 0.01;
        indiv.location = indiv.location.add(add);

        if (indiv.location.x < 0) {
            indiv.location.x = 0;
        } else if (indiv.location.x > self.width) {
            indiv.location.x = self.width;
        }

        if (indiv.location.y < 0) {
            indiv.location.y = 0;
        } else if (indiv.location.y > self.height) {
            indiv.location.y = self.height;
        }
    }
}
