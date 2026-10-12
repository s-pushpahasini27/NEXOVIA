// Liquid Film — Originkit 
 
"use client" 
 
import * as React from "react" 
import { useEffect, useRef } from "react" 
 
const MAX_DPR = 2 
const NAME = "LiquidFilm" 
 
const LAYERS = 90 
 
const CURRENT = 0.2 
const DRAG = 0.09 
const RING_SPEED = 260 
const RING_WIDTH = 70 
const RING_WAVE = 0.075 
const RING_DECAY = 1.1 
const RING_PUSH = 22 
const MAX_RIPPLES = 8 
const CLICK_LIFE = 5 
const WAKE_LIFE = 2.4 
const WAKE_STEP = 70 
const WAKE_GAP = 0.3 
const WAKE_AMP = 0.4 
const FADE_OUT = 0.6 
 
const VERT_SRC = `#version 300 es 
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)); 
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); } 
` 
 
const FIELD_SRC = `#version 300 es 
precision highp float; 
uniform vec2 uRes; 
uniform float uTime; 
uniform vec3 uC1; 
uniform vec3 uC2; 
uniform float uSize; 
uniform float uAngle; 
out vec4 o; 
 
const float TAU = 6.28318530718; 
const float LAYERS = ${LAYERS.toFixed(1)}; 
const float GAIN = 0.62; 
 
const vec2 CENTRE = vec2(-0.5, -0.05); 
const float TILT = -3.3; 
const float ZOOM = 1.05; 
const float THETA = 2.14; 
const float SHEAR = 0.967; 
const float SHRINK = 0.955; 
const vec2 WARP_FREQ = vec2(0.36, 2.2); 
const vec2 WARP_AMP = vec2(0.12, 0.024); 
const vec2 ASPECT = vec2(2.4, 0.15); 
const float OFFSET = 0.39; 
const float GLOW = 0.0021; 
const float SOFT = 0.0019; 
const float FALLOFF = 0.37; 
const float PHASE = 71.0; 
const float CYCLE = 0.16; 
const float HUE_TRAVEL = 2.0; 
 
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); } 
 
void main() { 
  vec2 R = uRes; 
  vec2 pos = (gl_FragCoord.xy - 0.5 * R) / R.y; 
 
  pos = rot(uAngle) * pos / uSize; 
  float t = uTime * 0.49 + PHASE; 
  float breath = (-sin(uTime * 0.735) + sin(uTime * 0.49 + 1.0)) * 0.25 + 0.5; 
  vec2 u = rot(TILT) * ((pos - CENTRE) * (ZOOM - breath * 0.085)); 
  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA)); 
 
  vec3 col = vec3(0.0); 
  for (float i = 1.0; i <= LAYERS; i += 1.0) { 
    u.x -= sin(u.y * WARP_FREQ.x + t + i * 0.007) * WARP_AMP.x; 
    u.y -= sin(u.x * WARP_FREQ.y - t + i * 0.02) * WARP_AMP.y; 
    u = fold * u * SHRINK; 
    vec2 q = (u - vec2(OFFSET + breath * 0.1, 0.0)) * ASPECT; 
    float g = GLOW / (dot(q, q) + SOFT) * (0.25 + breath * 0.4); 
    float r = length(u); 
    float k = sin(i * CYCLE + t * 1.2 + r * HUE_TRAVEL) * 0.5 + 0.5; 
    col += g * mix(uC1, uC2, k) * (0.62 + 0.5 * k) * exp2(-r * FALLOFF); 
  } 
  vec3 x = max(col * GAIN, 0.0); 
  col = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); 
  col = pow(clamp(col, 0.0, 1.0), vec3(0.85, 0.92, 0.98)); 
  col *= 1.0 - smoothstep(0.5, 1.6, length(pos)) * 0.07; 
  o = vec4(col, 1.0); 
} 
` 
 
const FINISH_SRC = `#version 300 es 
precision highp float; 
uniform sampler2D uField; 
uniform vec2 uRes; 
uniform float uTime; 
uniform vec3 uBg; 
uniform float uPaper; 
uniform float uPR; 
uniform vec2 uMouse; 
uniform float uOn; 
uniform float uReach; 
uniform vec2 uVel; 
uniform vec4 uRip[${MAX_RIPPLES}]; 
uniform int uRipN; 
uniform float uFlow; 
out vec4 o; 
 
const float CURRENT = ${CURRENT.toFixed(3)}; 
const float DRAG = ${DRAG.toFixed(3)}; 
const float RING_SPEED = ${RING_SPEED.toFixed(1)}; 
const float RING_WIDTH = ${RING_WIDTH.toFixed(1)}; 
const float RING_WAVE = ${RING_WAVE.toFixed(4)}; 
const float RING_DECAY = ${RING_DECAY.toFixed(3)}; 
const float RING_PUSH = ${RING_PUSH.toFixed(1)}; 
 
float ign(vec2 p, float f) { p += 5.588238 * mod(f, 64.0); return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); } 
 
vec3 scene(vec2 uv) { return texture(uField, clamp(uv, 0.0, 1.0)).rgb; } 
 
float near(vec2 p) { vec2 d = (p - uMouse) / (uPR * uReach); return uOn * exp(-dot(d, d)); } 
 
vec2 current(vec2 p, float t) { 
  vec2 q = p + 0.2 * vec2(sin(p.y * 2.9 + t * 0.23), sin(p.x * 2.5 - t * 0.19)); 
  vec2 a = vec2(0.932, 0.362), b = vec2(-0.622, 0.783), c = vec2(0.249, 0.968); 
  return 0.36 * cos(dot(q, a) * 9.0 - t * 0.6) * a 
       + 0.22 * cos(dot(q, b) * 15.0 - t * 0.8 + 2.0) * b 
       + 0.12 * cos(dot(q, c) * 22.0 - t * 1.05 + 4.1) * c; 
} 
 
void main() { 
  vec2 frag = gl_FragCoord.xy; 
  vec2 uv = frag / uRes; 
  vec2 css = uRes / uPR; 
  float aspect = uRes.x / uRes.y; 
  vec2 p = (frag - 0.5 * uRes) / uRes.y; 
 
  vec2 shift = current(p, uTime) * (CURRENT * uFlow) * vec2(1.0 / aspect, 1.0); 
 
  float w = near(frag); 
  if (w > 1e-4) shift -= uVel / css * w * DRAG; 
 
  for (int i = 0; i < ${MAX_RIPPLES}; i++) { 
    if (i >= uRipN) break; 
    vec4 r = uRip[i]; 
    vec2 dv = (frag - r.xy) / uPR; 
    float dist = length(dv); 
    float s = dist - RING_SPEED * r.z; 
    float env = exp(-s * s / (RING_WIDTH * RING_WIDTH)) * exp(-RING_DECAY * r.z) * r.w * smoothstep(0.0, 0.2, r.z); 
    shift += dv / max(dist, 1.0) * sin(s * RING_WAVE) * env * RING_PUSH / css; 
  } 
 
  vec3 L = max(scene(uv + shift), 0.0); 
 
  vec3 dark = uBg + L * (1.0 - uBg); 
  float strength = clamp(max(L.r, max(L.g, L.b)), 0.0, 1.0); 
  vec3 paper = uBg * (1.0 - strength) + L * 0.96; 
  vec3 col = mix(dark, paper, uPaper); 
  col += (ign(frag, floor(uTime * 24.0)) - 0.5) / 255.0; 
  o = vec4(clamp(col, 0.0, 1.0), 1.0); 
} 
` 
 
type RGB = [number, number, number] 
 
const colorCache = new Map<string, RGB | null>() 
 
function parseColor(input: string | undefined): RGB | null { 
    if (!input) return null 
    const key = String(input) 
    if (colorCache.has(key)) return colorCache.get(key) ?? null 
    let s = key.trim() 
    const v = s.match(/^var\(\s*--[^,]+,\s*(.+)\)$/) 
    if (v) s = v[1].trim() 
    let out: RGB | null = null 
    if (s.charAt(0) === "#") { 
        let h = s.slice(1) 
        if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] 
        if (h.length >= 6) { 
            const r = parseInt(h.slice(0, 2), 16) 
            const g = parseInt(h.slice(2, 4), 16) 
            const b = parseInt(h.slice(4, 6), 16) 
            if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) out = [r / 255, g / 255, b / 255] 
        } 
    } else { 
        const m = s.match(/^(rgba?|hsla?)\(([^)]*)\)/i) 
        if (m) { 
            const parts = m[2].split(/[\s,/]+/).filter(Boolean) 
            const f = (i: number) => parseFloat(parts[i]) 
            if (parts.length >= 3 && [0, 1, 2].every((i) => Number.isFinite(f(i)))) { 
                if (m[1].toLowerCase().startsWith("rgb")) { 
                    const ch = (i: number) => (parts[i].endsWith("%") ? f(i) / 100 : f(i) / 255) 
                    out = [ch(0), ch(1), ch(2)] 
                } else { 
                    const hh = (((f(0) % 360) + 360) % 360) / 360 
                    const ss = f(1) / 100 
                    const ll = f(2) / 100 
                    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss 
                    const p = 2 * ll - q 
                    const hue = (t: number) => { 
                        t = t < 0 ? t + 1 : t > 1 ? t - 1 : t 
                        if (t < 1 / 6) return p + (q - p) * 6 * t 
                        if (t < 1 / 2) return q 
                        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6 
                        return p 
                    } 
                    out = [hue(hh + 1 / 3), hue(hh), hue(hh - 1 / 3)] 
                } 
                out = out.map((c) => Math.min(1, Math.max(0, c))) as RGB 
            } 
        } 
    } 
    colorCache.set(key, out) 
    return out 
} 
 
function color(input: string | undefined, fallback: string): RGB { 
    return parseColor(input) ?? (parseColor(fallback) as RGB) 
} 
 
function num(v: unknown, fb: number): number { 
    return typeof v === "number" && isFinite(v) ? v : fb 
} 
 
function clampN(v: number, lo: number, hi: number): number { 
    return v < lo ? lo : v > hi ? hi : v 
} 
 
function link(gl: WebGL2RenderingContext, frag: string, label: string): WebGLProgram | null { 
    const shader = (type: number, src: string) => { 
        const sh = gl.createShader(type) 
        if (!sh) return null 
        gl.shaderSource(sh, src) 
        gl.compileShader(sh) 
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { 
            console.error(`${NAME} ${label} shader:`, gl.getShaderInfoLog(sh)) 
            gl.deleteShader(sh) 
            return null 
        } 
        return sh 
    } 
    const vs = shader(gl.VERTEX_SHADER, VERT_SRC) 
    const fs = shader(gl.FRAGMENT_SHADER, frag) 
    if (!vs || !fs) return null 
    const prog = gl.createProgram() 
    if (!prog) return null 
    gl.attachShader(prog, vs) 
    gl.attachShader(prog, fs) 
    gl.linkProgram(prog) 
    gl.deleteShader(vs) 
    gl.deleteShader(fs) 
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { 
        console.error(`${NAME} ${label} link:`, gl.getProgramInfoLog(prog)) 
        gl.deleteProgram(prog) 
        return null 
    } 
    return prog 
} 
 
function locations(gl: WebGL2RenderingContext, prog: WebGLProgram, names: string[]) { 
    const out: Record<string, WebGLUniformLocation | null> = {} 
    for (const n of names) out[n] = gl.getUniformLocation(prog, n) 
    return out 
} 
 
function fieldTarget(gl: WebGL2RenderingContext) { 
    const fbo = gl.createFramebuffer() 
    let tex: WebGLTexture | null = null 
    let w = 0 
    let h = 0 
    let half = !!gl.getExtension("EXT_color_buffer_float") 
    return { 
        fbo, 
        texture: () => tex, 
        width: () => w, 
        height: () => h, 
        resize(nw: number, nh: number) { 
            if (nw === w && nh === h && tex) return 
            for (let attempt = 0; attempt < 2; attempt++) { 
                if (tex) gl.deleteTexture(tex) 
                tex = gl.createTexture() 
                gl.bindTexture(gl.TEXTURE_2D, tex) 
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR) 
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR) 
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE) 
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE) 
                gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, nw, nh, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null) 
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo) 
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0) 
                const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE 
                gl.bindFramebuffer(gl.FRAMEBUFFER, null) 
                if (ok || !half) break 
                half = false 
            } 
            w = nw 
            h = nh 
        }, 
        dispose() { 
            if (tex) gl.deleteTexture(tex) 
            gl.deleteFramebuffer(fbo) 
        }, 
    } 
} 
 
function trackPointer(root: HTMLElement, onDown?: (x: number, y: number) => void) { 
    const p = { tx: 0, ty: 0, inside: false, seen: false } 
    const read = (e: PointerEvent) => { 
        const r = root.getBoundingClientRect() 
        const sx = root.offsetWidth / (r.width || 1) 
        const sy = root.offsetHeight / (r.height || 1) 
        p.tx = (e.clientX - r.left) * sx 
        p.ty = (e.clientY - r.top) * sy 
        p.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom 
        p.seen = true 
    } 
    const down = (e: PointerEvent) => { 
        read(e) 
        if (p.inside && onDown) onDown(p.tx, p.ty) 
    } 
    const out = (e: PointerEvent) => { 
        if (!e.relatedTarget) p.inside = false 
    } 
    window.addEventListener("pointermove", read, { passive: true }) 
    window.addEventListener("pointerdown", down, { passive: true }) 
    document.addEventListener("pointerout", out) 
    return { 
        p, 
        dispose() { 
            window.removeEventListener("pointermove", read) 
            window.removeEventListener("pointerdown", down) 
            document.removeEventListener("pointerout", out) 
        }, 
    } 
} 
 
type Ripple = { x: number; y: number; age: number; amp: number; life: number } 
 
const DEFAULTS = { 
    background: "#0B0A10", 
    color1: "#29F0C4", 
    color2: "#4800FF", 
} 
 
interface LiquidFilmProps { 
    style?: React.CSSProperties 
    background?: string 
    color1?: string 
    color2?: string 
    speed?: number 
    size?: number 
    angle?: number 
    flow?: number 
    ripple?: number 
    hover?: number 
    reach?: number 
    width?: number 
    height?: number 
} 
 
export default function LiquidFilm(props: LiquidFilmProps) { 
    const { 
        style, 
        background = DEFAULTS.background, 
        color1 = DEFAULTS.color1, 
        color2 = DEFAULTS.color2, 
        speed = 50, 
        size = 147, 
        angle = 73, 
        flow = 200, 
        ripple = 200, 
        hover = 100, 
        reach = 300, 
        width, 
        height, 
    } = props 
 
    const rootRef = useRef<HTMLDivElement>(null) 
    const canvasRef = useRef<HTMLCanvasElement>(null) 
 
    const vRef = useRef({ background, color1, color2, speed: 1, size: 1, angle: 0, flow: 1, ripple: 1, hover: 1, reach: 200 }) 
    vRef.current = { 
        background, 
        color1, 
        color2, 
 
        speed: clampN(num(speed, 50), 0, 100) / 50, 
        size: clampN(num(size, 100), 50, 200) / 100, 
 
        angle: (clampN(num(angle, 0), -180, 180) * Math.PI) / 180, 
        flow: clampN(num(flow, 100), 0, 200) / 100, 
        ripple: clampN(num(ripple, 100), 0, 200) / 100, 
        hover: clampN(num(hover, 100), 0, 200) / 100, 
        reach: clampN(num(reach, 200), 10, 800), 
    } 
 
    useEffect(() => { 
        const canvas = canvasRef.current 
        const root = rootRef.current 
        if (!canvas || !root) return 
        const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false }) 
        if (!gl) { 
            console.error(`${NAME}: WebGL2 unavailable`) 
            return 
        } 
        const field = link(gl, FIELD_SRC, "field") 
        const finish = link(gl, FINISH_SRC, "finish") 
        if (!field || !finish) return 
        const uf = locations(gl, field, ["uRes", "uTime", "uC1", "uC2", "uSize", "uAngle"]) 
        const un = locations(gl, finish, ["uField", "uRes", "uTime", "uBg", "uPaper", "uPR", "uMouse", "uOn", "uReach", "uVel", "uRip", "uRipN", "uFlow"]) 
        const vao = gl.createVertexArray() 
        gl.bindVertexArray(vao) 
        const target = fieldTarget(gl) 
 
        const ripples: Ripple[] = [] 
        const RIP = new Float32Array(MAX_RIPPLES * 4) 
        const addRipple = (r: Ripple, click: boolean) => { 
            if (ripples.length >= MAX_RIPPLES) { 
                let i = ripples.findIndex((q) => q.life === WAKE_LIFE) 
                if (i < 0) { 
                    if (!click) return 
                    i = 0 
                } 
                ripples.splice(i, 1) 
            } 
            ripples.push(r) 
        } 
        const pointer = trackPointer(root, (x, y) => addRipple({ x, y, age: 0, amp: 1, life: CLICK_LIFE }, true)) 
        const ptr = pointer.p 
 
        let mx = 0 
        let my = 0 
        let vx = 0 
        let vy = 0 
        let on = 0 
        let raf = 0 
        let last = -1 
        let clock = 0 
        let travel = 0 
        let sinceWake = WAKE_GAP 
 
        const render = (now: number) => { 
            raf = requestAnimationFrame(render) 
            const dt = last < 0 ? 0 : clampN((now - last) / 1000, 0, 0.05) 
            last = now 
            const v = vRef.current 
            clock = (clock + dt * v.speed) % 3600 
 
            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) 
            const cw = canvas.clientWidth || 1200 
            const ch = canvas.clientHeight || 800 
            const bw = Math.max(1, Math.round(cw * dpr)) 
            const bh = Math.max(1, Math.round(ch * dpr)) 
            if (canvas.width !== bw || canvas.height !== bh) { 
                canvas.width = bw 
                canvas.height = bh 
            } 
            target.resize(Math.max(1, Math.round(bw / 2)), Math.max(1, Math.round(bh / 2))) 
 
            const present = ptr.inside ? 1 : 0 
            if (present && on < 0.02) { 
                mx = ptr.tx 
                my = ptr.ty 
            } 
            on += (present - on) * (1 - Math.exp(-dt * 5)) 
            const k = 1 - Math.exp(-dt * 16) 
            const nx = mx + (ptr.tx - mx) * k 
            const ny = my + (ptr.ty - my) * k 
            if (dt > 0) { 
                const kv = 1 - Math.exp(-dt * 8) 
                vx += ((nx - mx) / dt - vx) * kv 
                vy += ((ny - my) / dt - vy) * kv 
            } 
 
            sinceWake += dt 
            if (present && v.hover > 0) { 
                travel += Math.hypot(nx - mx, ny - my) 
                if (travel >= WAKE_STEP && sinceWake >= WAKE_GAP) { 
                    addRipple({ x: nx, y: ny, age: 0, amp: WAKE_AMP * v.hover, life: WAKE_LIFE }, false) 
                    travel = 0 
                    sinceWake = 0 
                } 
            } else travel = 0 
            mx = nx 
            my = ny 
            const vLen = Math.hypot(vx, vy) / ch 
            const vCap = vLen > 3 ? 3 / vLen : 1 
 
            for (let i = ripples.length - 1; i >= 0; i--) { 
                ripples[i].age += dt 
                if (ripples[i].age > ripples[i].life) ripples.splice(i, 1) 
            } 
 
            const c1 = color(v.color1, DEFAULTS.color1) 
            const c2 = color(v.color2, DEFAULTS.color2) 
            const bg = color(v.background, DEFAULTS.background) 
            const bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2] 
 
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo) 
            gl.viewport(0, 0, target.width(), target.height()) 
            gl.useProgram(field) 
            gl.uniform2f(uf.uRes, target.width(), target.height()) 
            gl.uniform1f(uf.uTime, clock) 
            gl.uniform3f(uf.uC1, c1[0], c1[1], c1[2]) 
            gl.uniform3f(uf.uC2, c2[0], c2[1], c2[2]) 
            gl.uniform1f(uf.uSize, v.size) 
            gl.uniform1f(uf.uAngle, v.angle) 
            gl.drawArrays(gl.TRIANGLES, 0, 3) 
 
            const sx = bw / cw 
            const sy = bh / ch 
            let n = 0 
            if (v.ripple > 0) { 
                for (const r of ripples) { 
                    const t = clampN((r.age - (r.life - FADE_OUT)) / FADE_OUT, 0, 1) 
                    RIP[n * 4] = r.x * sx 
                    RIP[n * 4 + 1] = bh - r.y * sy 
                    RIP[n * 4 + 2] = r.age 
                    RIP[n * 4 + 3] = r.amp * v.ripple * (1 - t * t * (3 - 2 * t)) 
                    n++ 
                } 
            } 
            gl.bindFramebuffer(gl.FRAMEBUFFER, null) 
            gl.viewport(0, 0, bw, bh) 
            gl.useProgram(finish) 
            gl.activeTexture(gl.TEXTURE0) 
            gl.bindTexture(gl.TEXTURE_2D, target.texture()) 
            gl.uniform1i(un.uField, 0) 
            gl.uniform2f(un.uRes, bw, bh) 
            gl.uniform1f(un.uTime, clock) 
            gl.uniform3f(un.uBg, bg[0], bg[1], bg[2]) 
            gl.uniform1f(un.uPaper, clampN((bgLum - 0.35) / 0.3, 0, 1)) 
            gl.uniform1f(un.uPR, sx) 
            gl.uniform2f(un.uMouse, mx * sx, bh - my * sy) 
            gl.uniform1f(un.uOn, on * v.hover) 
            gl.uniform1f(un.uReach, v.reach) 
            gl.uniform2f(un.uVel, vx * vCap, -vy * vCap) 
            gl.uniform4fv(un.uRip, RIP) 
            gl.uniform1i(un.uRipN, n) 
            gl.uniform1f(un.uFlow, v.flow) 
            gl.drawArrays(gl.TRIANGLES, 0, 3) 
        } 
 
        raf = requestAnimationFrame(render) 
        return () => { 
            cancelAnimationFrame(raf) 
            pointer.dispose() 
            target.dispose() 
            gl.deleteVertexArray(vao) 
            gl.deleteProgram(field) 
            gl.deleteProgram(finish) 
        } 
    }, []) 
 
    return ( 
        <div 
            ref={rootRef} 
            style={{ 
                position: "relative", 
                overflow: "hidden", 
                background, 
                minWidth: 1200, 
                minHeight: 800, 
                width: typeof width === "number" && width > 0 ? width : "100%", 
                height: typeof height === "number" && height > 0 ? height : "100%", 
                ...style, 
            }} 
        > 
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} /> 
        </div> 
    ) 
}
