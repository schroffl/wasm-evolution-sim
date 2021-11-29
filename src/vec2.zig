const std = @import("std");
const Self = @This();

x: f32,
y: f32,

pub fn magnitude(a: Self) f32 {
    return std.math.sqrt(a.x * a.x + a.y * a.y);
}

pub fn normalize(a: Self) Self {
    const m = a.magnitude();

    return .{
        .x = a.x / m,
        .y = a.y / m,
    };
}

pub fn add(a: Self, b: Self) Self {
    return .{
        .x = a.x + b.x,
        .y = a.y + b.y,
    };
}

pub fn rotate(a: Self, phi: f32) Self {
    return .{
        .x = a.x * std.math.cos(phi) - a.y * std.math.sin(phi),
        .y = a.x * std.math.sin(phi) + a.y * std.math.cos(phi),
    };
}

pub fn scale(a: Self, scalar: f32) Self {
    return .{
        .x = a.x * scalar,
        .y = a.y * scalar,
    };
}
