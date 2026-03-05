import {
  createCard,
  setStatus,
  compileShader,
  linkProgram,
  createStaticTextures,
  createFFTTexture,
  updateFFTTexture,
  bindIfPresent,
  resizeCanvasToDisplaySize,
} from "./webgl.ts";
import { prepareFragmentSource } from "./glsl.ts";
import {
  sampleAudioFFT,
  updateAudioDebug,
  ensureAudioRunning,
  isAudioUnlocked,
} from "./audio.ts";

// types used by renderer
export type ShaderInstance = {
  gl: WebGL2RenderingContext;
  ui: {
    root: HTMLElement;
    canvas: HTMLCanvasElement;
    statusEl: HTMLElement;
    log: HTMLElement;
  };
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  usesTexFFT: boolean;
  usesTexFFTSmoothed: boolean;
  usesTexFFTIntegrated: boolean;
  fft: { tex: WebGLTexture; data: Float32Array };
  fftSmooth: { tex: WebGLTexture; data: Float32Array };
  fftIntegrated: { tex: WebGLTexture; data: Float32Array };
  frame: number;
  profile: string;
};

export type Timings = {
  startTime: number;
  lastFrameTime: { value: number };
  musicFile: string | null;
};

// shared geometry used by all shader boxes
export const vertexSource = `#version 300 es
precision highp float;
const vec2 verts[3] = vec2[3](
	vec2(-1.0, -1.0),
	vec2(3.0, -1.0),
	vec2(-1.0, 3.0)
);
void main() {
	gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
}`;

// instances returned from setupShaderBox are objects that driver the render loop.
export async function setupShaderBox(
  fileName: string,
  container: HTMLElement,
  baseUrl: string,
): Promise<ShaderInstance | null> {
  const ui = createCard(fileName);
  container.append(ui.root);

  const gl = ui.canvas.getContext("webgl2");
  if (!gl) {
    setStatus(ui, false, "No WebGL2", "WebGL2 context could not be created.");
    return null;
  }

  try {
    const shaderUrl = `${baseUrl}shaders/${fileName}`;
    const source = await fetch(shaderUrl).then((r) => {
      if (!r.ok)
        throw new Error(
          `Failed to fetch shader (${r.status}) from ${shaderUrl}`,
        );
      return r.text();
    });

    const prepared = prepareFragmentSource(source);
    const fragmentSource = prepared.source;

    const v = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const f = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const linked = linkProgram(gl, v.shader, f.shader);

    gl.deleteShader(v.shader);
    gl.deleteShader(f.shader);

    const staticTextures = createStaticTextures(gl);
    const fft = createFFTTexture(gl);
    const fftSmooth = createFFTTexture(gl);
    const fftIntegrated = createFFTTexture(gl);

    const uniforms = {
      fGlobalTime: gl.getUniformLocation(linked.program, "fGlobalTime"),
      fFrameTime: gl.getUniformLocation(linked.program, "fFrameTime"),
      v2Resolution: gl.getUniformLocation(linked.program, "v2Resolution"),
      iResolution: gl.getUniformLocation(linked.program, "iResolution"),
      iTime: gl.getUniformLocation(linked.program, "iTime"),
      iTimeDelta: gl.getUniformLocation(linked.program, "iTimeDelta"),
      iFrame: gl.getUniformLocation(linked.program, "iFrame"),
      iMouse: gl.getUniformLocation(linked.program, "iMouse"),
      iDate: gl.getUniformLocation(linked.program, "iDate"),
      iSampleRate: gl.getUniformLocation(linked.program, "iSampleRate"),
    };

    bindIfPresent(gl, linked.program, "texFFT", fft.tex, 0);
    bindIfPresent(gl, linked.program, "texFFTSmoothed", fftSmooth.tex, 1);
    bindIfPresent(
      gl,
      linked.program,
      "texFFTIntegrated",
      fftIntegrated.tex,
      2,
    );
    bindIfPresent(
      gl,
      linked.program,
      "texPreviousFrame",
      staticTextures.black,
      3,
    );
    bindIfPresent(
      gl,
      linked.program,
      "texChecker",
      staticTextures.checker,
      4,
    );
    bindIfPresent(gl, linked.program, "texNoise", staticTextures.noise, 5);
    bindIfPresent(gl, linked.program, "texTex1", staticTextures.noise, 6);
    bindIfPresent(gl, linked.program, "texTex2", staticTextures.checker, 7);
    bindIfPresent(gl, linked.program, "texTex3", staticTextures.black, 8);
    bindIfPresent(gl, linked.program, "texTex4", staticTextures.noise, 9);
    bindIfPresent(gl, linked.program, "iChannel0", staticTextures.noise, 10);
    bindIfPresent(
      gl,
      linked.program,
      "iChannel1",
      staticTextures.checker,
      11,
    );
    bindIfPresent(gl, linked.program, "iChannel2", staticTextures.black, 12);
    bindIfPresent(gl, linked.program, "iChannel3", fft.tex, 13);

    setStatus(
      ui,
      true,
      "Running",
      [v.info, f.info, linked.info].filter(Boolean).join("\n") ||
        "Compiled successfully.",
    );

    return {
      gl,
      ui,
      program: linked.program,
      uniforms,
      usesTexFFT: gl.getUniformLocation(linked.program, "texFFT") !== null,
      usesTexFFTSmoothed:
        gl.getUniformLocation(linked.program, "texFFTSmoothed") !== null,
      usesTexFFTIntegrated:
        gl.getUniformLocation(linked.program, "texFFTIntegrated") !== null,
      fft,
      fftSmooth,
      fftIntegrated,
      frame: 0,
      profile: prepared.profile,
    };
  } catch (err) {
    const details = String(err.message || err);
    setStatus(ui, false, "Error", details);
    return null;
  }
}

// we keep track of timing inside the caller; pass them in by reference
export function renderAll(
  instances: Array<ShaderInstance | null>,
  now: number,
  audioSystem: any,
  timings: Timings,
): void {
  const { startTime, lastFrameTime } = timings;
  const t = (now - startTime) * 0.001;
  const dt = (now - lastFrameTime.value) * 0.001;
  lastFrameTime.value = now;

  if (audioSystem && isAudioUnlocked()) {
    if (!audioSystem._lastEnsure || now - audioSystem._lastEnsure > 1000) {
      audioSystem._lastEnsure = now;
      if (!audioSystem.analyser) {
        ensureAudioRunning(audioSystem);
      } else if (
        audioSystem.context &&
        audioSystem.context.state !== "running"
      ) {
        ensureAudioRunning(audioSystem);
      }
    }
  }

  const fftData = sampleAudioFFT(audioSystem, dt);
  updateAudioDebug(audioSystem, fftData, instances, now, timings.musicFile);

  for (const instance of instances) {
    if (!instance) continue;
    const { gl, ui, program, uniforms, fft, fftSmooth, fftIntegrated } =
      instance;

    resizeCanvasToDisplaySize(ui.canvas);
    gl.viewport(0, 0, ui.canvas.width, ui.canvas.height);

    updateFFTTexture(gl, fft, fftData.raw);
    updateFFTTexture(gl, fftSmooth, fftData.smooth);
    updateFFTTexture(gl, fftIntegrated, fftData.integrated);

    gl.useProgram(program);

    if (uniforms.fGlobalTime) gl.uniform1f(uniforms.fGlobalTime, t);
    if (uniforms.fFrameTime) gl.uniform1f(uniforms.fFrameTime, dt);
    if (uniforms.v2Resolution)
      gl.uniform2f(uniforms.v2Resolution, ui.canvas.width, ui.canvas.height);
    if (uniforms.iResolution)
      gl.uniform3f(
        uniforms.iResolution,
        ui.canvas.width,
        ui.canvas.height,
        1,
      );
    if (uniforms.iTime) gl.uniform1f(uniforms.iTime, t);
    if (uniforms.iTimeDelta) gl.uniform1f(uniforms.iTimeDelta, dt);
    if (uniforms.iFrame) gl.uniform1i(uniforms.iFrame, instance.frame || 0);
    if (uniforms.iMouse) gl.uniform4f(uniforms.iMouse, 0, 0, 0, 0);
    if (uniforms.iDate) {
      const nowDate = new Date();
      const secs =
        nowDate.getHours() * 3600 +
        nowDate.getMinutes() * 60 +
        nowDate.getSeconds() +
        nowDate.getMilliseconds() / 1000;
      gl.uniform4f(
        uniforms.iDate,
        nowDate.getFullYear(),
        nowDate.getMonth() + 1,
        nowDate.getDate(),
        secs,
      );
    }
    if (uniforms.iSampleRate) gl.uniform1f(uniforms.iSampleRate, 44100);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    instance.frame = (instance.frame || 0) + 1;
  }

  requestAnimationFrame((next) => renderAll(instances, next, audioSystem, timings));
}

