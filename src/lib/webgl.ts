export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): { shader: WebGLShader; info: string } {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  const info = gl.getShaderInfoLog(shader) || "";
  if (!ok) {
    gl.deleteShader(shader);
    throw new Error(info.trim() || "Unknown shader compile error");
  }
  return { shader, info: info.trim() };
}

export function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): { program: WebGLProgram; info: string } {
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
  const info = gl.getProgramInfoLog(program) || "";
  if (!ok) {
    gl.deleteProgram(program);
    throw new Error(info.trim() || "Unknown program link error");
  }
  return { program, info: info.trim() };
}

export function makeTexture(
  gl: WebGL2RenderingContext,
  internalFormat: number,
  width: number,
  height: number,
  format: number,
  type: number,
  pixels: ArrayBufferView | null,
  options: {
    minFilter?: number;
    magFilter?: number;
    wrapS?: number;
    wrapT?: number;
  } = {},
): WebGLTexture {
  const {
    minFilter = gl.LINEAR,
    magFilter = gl.LINEAR,
    wrapS = gl.REPEAT,
    wrapT = gl.REPEAT,
  } = options;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    width,
    height,
    0,
    format,
    type,
    pixels,
  );
  return tex;
}

export function createStaticTextures(gl: WebGL2RenderingContext) {
  const black = makeTexture(
    gl,
    gl.RGBA,
    1,
    1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  );

  const checkerData = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const on = ((x >> 3) & 1) ^ ((y >> 3) & 1);
      const c = on ? 235 : 30;
      const i = (y * 64 + x) * 4;
      checkerData[i + 0] = c;
      checkerData[i + 1] = c;
      checkerData[i + 2] = c;
      checkerData[i + 3] = 255;
    }
  }
  const checker = makeTexture(
    gl,
    gl.RGBA,
    64,
    64,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    checkerData,
  );

  const noiseData = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < noiseData.length; i += 4) {
    const v = Math.floor(Math.random() * 256);
    noiseData[i + 0] = v;
    noiseData[i + 1] = v;
    noiseData[i + 2] = v;
    noiseData[i + 3] = 255;
  }
  const noise = makeTexture(
    gl,
    gl.RGBA,
    64,
    64,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    noiseData,
  );

  return { black, checker, noise };
}

import { FFT_BIN_COUNT } from "./constants.ts";

export function createFFTTexture(gl: WebGL2RenderingContext): { tex: WebGLTexture; data: Float32Array } {
  const data = new Float32Array(FFT_BIN_COUNT);
  const tex = makeTexture(
    gl,
    gl.R32F,
    FFT_BIN_COUNT,
    1,
    gl.RED,
    gl.FLOAT,
    data,
    {
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.REPEAT,
      wrapT: gl.CLAMP_TO_EDGE,
    },
  );
  return { tex, data };
}

export function updateFFTTexture(gl: WebGL2RenderingContext, fft: { tex: WebGLTexture; data: Float32Array }, data: Float32Array) {
  for (let i = 0; i < dst.length; i += 1) dst[i] = data[i] || 0;
  gl.bindTexture(gl.TEXTURE_2D, fft.tex);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    FFT_BIN_COUNT,
    1,
    gl.RED,
    gl.FLOAT,
    dst,
  );
}

export function bindIfPresent(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  texture: WebGLTexture,
  unit: number,
) {
  const loc = gl.getUniformLocation(program, name);
  if (loc === null) return;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(loc, unit);
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

export function createCard(name: string) {
  const root = document.createElement("article");
  root.className = "card";

  const head = document.createElement("div");
  head.className = "card-head";

  const nameEl = document.createElement("div");
  nameEl.className = "name";
  nameEl.textContent = name;

  const statusEl = document.createElement("div");
  statusEl.className = "status";

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;

  const log = document.createElement("pre");
  log.className = "log";

  head.append(nameEl, statusEl);
  root.append(head, canvas, log);

  return { root, canvas, statusEl, log };
}

export function setStatus(ui: { root: HTMLElement; canvas: HTMLCanvasElement; statusEl: HTMLElement; log: HTMLElement }, ok: boolean, text: string, details = "") {
  ui.statusEl.className = `status ${ok ? "ok" : "err"}`;
  ui.statusEl.textContent = text;
  ui.log.className = `log ${ok ? "ok-log" : ""}`;
  ui.log.textContent = details;
}
