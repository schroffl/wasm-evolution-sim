const Genome = @import("./genome.zig").Genome;
const Vec2 = @import("./vec2.zig");

const Self = @This();

location: Vec2,
rotation: f32,
genome: Genome,

pub fn writeTo(self: Self, writer: anytype) !void {
    try writer.writeIntLittle(u32, @bitCast(u32, self.location.x));
    try writer.writeIntLittle(u32, @bitCast(u32, self.location.y));
    try writer.writeIntLittle(u32, @bitCast(u32, self.rotation));
}
