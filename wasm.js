function getString(inst, ptr, len) {
    const slice = deref(Uint8Array, inst, ptr, len);
    let arr = [];

    for (let i = 0; i < slice.length; i++) {
        const char = String.fromCharCode(slice[i]);
        arr.push(char);
    }

    return arr.join('');
}

function deref(T, inst, ptr, len) {
    return new T(inst.exports.memory.buffer, ptr, len);
}

async function loadWasm() {
    const res = await fetch('./zig-out/lib/boid-sim.wasm');
    const wasm_buf = await res.arrayBuffer();
    const wasm = await WebAssembly.instantiate(wasm_buf, {
        debug: {
            js_log: (buf, len) => {
                const str = getString(wasm.instance, buf, len);
                console.log(str);
            },
            js_err: (buf, len) => {
                const str = getString(wasm.instance, buf, len);
                console.error(str);
            },
            log_write: (buf, len) => {
                log_messages.innerText += getString(wasm.instance, buf, len);
            },
        },
    });

    return wasm;
}

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const resize_observer = new ResizeObserver(entries => {
    const rect = entries[0].contentRect;
    canvas.width = rect.width;
    canvas.height = rect.height;
});

resize_observer.observe(canvas);

canvas.width = 700;
canvas.height = 700;

function iterateView(view, item_size, cb) {
    const len = view.byteLength / item_size;

    console.assert(len === Math.floor(len));

    for (let i = 0; i < len; i++) {
        const item = new DataView(view.buffer, view.byteOffset + i * item_size, item_size);
        cb(item);
    }
}

const world_config = {
    width: 50,
    height: 50,
    seed: 0,
    count: 10000,
};

const wasm_promise = loadWasm().then(wasm => {
    wasm.instance.exports.initWorld(
        world_config.width,
        world_config.height,
        world_config.seed,
        world_config.count,
    );

    return wasm;
});

const gl = canvas.getContext('webgl2');

const vertex_shader = `#version 300 es
precision mediump float;

in vec2 vpos;
in vec2 world_pos;
in float rotation;

in float scale;

uniform mat4 view_matrix;

out vec2 uv;

void main() {
    uv = vpos * 0.5 + 0.5;

    mat2 rot = mat2(
        cos(rotation), -sin(rotation),
        sin(rotation),  cos(rotation)
    );

    vec2 pos = vpos * scale * rot;

    gl_Position = view_matrix * vec4(world_pos + pos, 0.0, 1.0);
}
`;
const fragment_shader = `#version 300 es
precision mediump float;

in vec2 uv;
out vec4 outColor;

uniform sampler2D tex;

void main() {
    outColor = texture(tex, uv);
}
`;

const vshader = gl.createShader(gl.VERTEX_SHADER);
const fshader = gl.createShader(gl.FRAGMENT_SHADER);
const program = gl.createProgram();

gl.shaderSource(vshader, vertex_shader);
gl.compileShader(vshader);
console.log(gl.getShaderInfoLog(vshader));
gl.shaderSource(fshader, fragment_shader);
gl.compileShader(fshader);
console.log(gl.getShaderInfoLog(fshader));

gl.attachShader(program, vshader);
gl.attachShader(program, fshader);
gl.linkProgram(program);
console.assert(gl.getProgramParameter(program, gl.LINK_STATUS));

gl.useProgram(program);

const tex = gl.createTexture();

const vbuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    -1,  1,
     1,  1,

     1,  1,
     1, -1,
    -1, -1,
]), gl.STATIC_DRAW);

const locs = getProgramAttribs(program);
const uniforms = getProgramUniforms(program);
console.log(locs, uniforms);

gl.vertexAttribPointer(locs.vpos, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(locs.vpos);
gl.vertexAttribDivisor(locs.vpos, 0);

const testdata = new Float32Array([ 0, 0, 0.3 ]);
const databuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, databuf);
gl.bufferData(gl.ARRAY_BUFFER, testdata, gl.DYNAMIC_DRAW);

gl.vertexAttribPointer(locs.world_pos, 2, gl.FLOAT, false, 12, 0);
gl.enableVertexAttribArray(locs.world_pos);
gl.vertexAttribDivisor(locs.world_pos, 1);

gl.vertexAttribPointer(locs.rotation, 1, gl.FLOAT, false, 12, 8);
gl.enableVertexAttribArray(locs.rotation);
gl.vertexAttribDivisor(locs.rotation, 1);

gl.vertexAttrib1f(locs.scale, 1);

gl.uniform1i(uniforms.tex, 0);

const tex_promise = generateTexture({
    size: 256,
    radius: 70,
    antenna_spacing: Math.PI / 6,
    colors: {
        body: 'lightblue',
        antennae: 'red',
    },
}).then(img => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
});

function generateTexture(config) {
    const size = config.size;
    const c = size / 2;
    const r = config.radius;

    const cv = document.createElement('canvas');

    cv.width = size;
    cv.height = size;

    const ctx = cv.getContext('2d');
    ctx.fillStyle = config.colors.body;

    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = r * 0.2;
    ctx.strokeStyle = 'darkblue';
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();

    const phi = config.antenna_spacing;
    const ar = r * 0.2;

    let ax = Math.cos(phi);
    let ay = Math.sin(phi);

    ctx.fillStyle = config.colors.antennae;
    ctx.lineCap = 'round';
    ctx.lineWidth = 30;

    ctx.beginPath();
    ctx.arc(c + ax * r, c + ay * r, ar, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(c + ax * r, c - ay * r, ar, 0, Math.PI * 2);
    ctx.fill();

    const url = cv.toDataURL('image/png');
    const img = new Image();

    return new Promise((resolve, reject) => {
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', err => reject(err));
        img.src = url;
    });
}

function getProgramAttribs(program) {
    const count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    const location_map = {};

    for (let i = 0; i < count; i++) {
        const info = gl.getActiveAttrib(program, i);
        location_map[info.name] = gl.getAttribLocation(program, info.name);
    }

    return location_map;
}

function getProgramUniforms(program) {
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    const location_map = {};

    for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i);
        location_map[info.name] = gl.getUniformLocation(program, info.name);
    }

    return location_map;
}

function render(indivs, camera) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const cx = camera.size * aspect;
    const cy = camera.size;

    const view_matrix = new Float32Array([
        2 / cx, 0, 0, 0,
        0, -2 / cy, 0, 0,
        0, 0, 1, 0,
        -camera.x / camera.size * 2, camera.y / camera.size * 2, 0, 1,
    ]);
    gl.uniformMatrix4fv(uniforms.view_matrix, false, view_matrix);

    const count = indivs.getUint32(0);
    const data = new Uint8Array(indivs.buffer, indivs.byteOffset + 4, indivs.byteLength - 4);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.bindBuffer(gl.ARRAY_BUFFER, databuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
}

const cam = {
    x: world_config.width / 2,
    y: world_config.height / 2,
    size: Math.max(world_config.height, world_config.width),
};

Promise.all([wasm_promise, tex_promise]).then(result => {
    const wasm = result[0];
    window.wasm = wasm;

    const buf_len = 1024 * 1024 * 16;
    let buf = wasm.instance.exports.allocBuffer(buf_len);

    const fn = t => {
        const written = wasm.instance.exports.serializeWorld(buf, buf_len);
        const result = deref(DataView, wasm.instance, buf, written);

        cam.x += cam_velocity.x;
        cam.y += cam_velocity.y;

        cam.x = Math.max(0, Math.min(cam.x, world_config.width));
        cam.y = Math.max(0, Math.min(cam.y, world_config.height));

        if (!current_drag) {
            cam_velocity.x *= 0.93;
            cam_velocity.y *= 0.93;
        }

        render(result, cam);

        if (!window.paused) {
            wasm.instance.exports.stepWorld();
        }

        requestAnimationFrame(fn);
    };

    requestAnimationFrame(fn);
});

window.addEventListener('keydown', e => {
    if (e.keyCode === 32) {
        window.paused = !Boolean(window.paused);
    }

    if (e.key === 'Enter') {
        const was_paused = window.paused;
        window.paused = true;

        let i = 10;

        while (i-- > 0) {
            window.wasm.instance.exports.stepWorld();
        }

        window.paused = was_paused;
    }
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    e.stopPropagation();

    const max = Math.max(world_config.width, world_config.height);

    cam.size += e.deltaY ;
    cam.size = Math.max(10, Math.min(cam.size, max));
});

let current_drag = undefined;
let cam_velocity = {
    x: 0,
    y: 0,
};

canvas.addEventListener('pointerdown', e => {
    canvas.style.cursor = 'grabbing';
    current_drag = {
        x: e.x,
        y: e.y,
    };

    cam_velocity.x = cam_velocity.y = 0;
});

canvas.addEventListener('pointerup', e => {
    canvas.style.cursor = '';
    current_drag = undefined;
});

canvas.addEventListener('pointermove', e => {
    if (!current_drag)
        return;

    const diff_x = e.x - current_drag.x;
    const diff_y = e.y - current_drag.y;

    const min_size = 10;
    const max_size = Math.max(world_config.width, world_config.height);

    const zoom = (cam.size - min_size) / (max_size - min_size);
    const speed = zoom * 0.9 + 0.1;

    cam_velocity.x = diff_x * 0.01 * speed;
    cam_velocity.y = diff_y * 0.01 * speed;
});
