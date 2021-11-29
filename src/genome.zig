const std = @import("std");

pub const Gene = packed struct {
    pub const BitType = @Type(.{
        .Int = .{
            .signedness = .unsigned,
            .bits = @bitSizeOf(Gene),
        },
    });

    pub const SourceType = enum(u1) {
        sensor,
        neuron,
    };

    pub const SinkType = enum(u1) {
        action,
        neuron,
    };

    pub const Actions = enum(u4) {
        rotate,
        forward,
    };

    source_type: SourceType,
    source: u16,
    sink_type: SinkType,
    sink: u16,
    weight: i16,

    pub fn floatWeight(self: Gene) f32 {
        return @intToFloat(f32, self.weight) / std.math.maxInt(@TypeOf(self.weight));
    }

    pub fn toBits(self: Gene) BitType {
        return @bitCast(BitType, self);
    }

    pub fn fromBits(bits: BitType) Gene {
        return @bitCast(Gene, bits);
    }

    pub fn random(rand: *std.rand.Random) Gene {
        return .{
            .source_type = rand.enumValue(SourceType),
            .source = rand.int(u16),
            .sink_type = rand.enumValue(SinkType),
            .sink = rand.int(u16),
            .weight = rand.int(i16),
        };
    }
};

pub const Genome = std.ArrayList(Gene);

pub fn randomGenome(
    allocator: *std.mem.Allocator,
    rand: *std.rand.Random,
    max_size: usize,
) !Genome {
    const size = rand.uintAtMost(usize, max_size);
    var genome = try Genome.initCapacity(allocator, size);
    var i = size;

    while (i > 0) : (i -= 1) {
        try genome.append(Gene.random(rand));
    }

    return genome;
}

pub const Network = struct {
    connections: std.ArrayList(Gene),
    neurons: [8]f32,

    pub fn fromGenome(allocator: *std.mem.Allocator, genome: Genome) !Network {
        var self = Network{
            .connections = std.ArrayList(Gene).init(allocator),
            .neurons = [_]f32{0} ** 8,
        };

        _ = genome;

        return self;
    }
};
