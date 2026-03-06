// Utilities for compiling and running "Bonzomatic" GLSL shaders

export interface Uniforms {
  [name: string]: number | number[] | Float32Array;
}

// simple vertex shader used for fullscreen quad
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

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  const info = gl.getShaderInfoLog(shader) || "";
  if (!ok) {
    gl.deleteShader(shader);
    throw new Error(info.trim() || "Unknown shader compile error");
  }
  return shader;
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  return compile(gl, type, source);
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
  const info = gl.getProgramInfoLog(program) || "";
  if (!ok) {
    gl.deleteProgram(program);
    throw new Error(info.trim() || "Unknown program link error");
  }
  return program;
}

/**
 * Convenience helper that compiles the built-in vertex shader and a supplied
 * fragment source, then links them into a program.
 */
export function createProgramFromFragment(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  return linkProgram(gl, vs, fs);
}

/**
 * Set a uniform value based on the JS type. This is intentionally unopinionated
 * and only handles floats/vectors so that users can call it in a tight render
 * loop without having to switch on the type themselves.
 */
export function setUniform(
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation | null,
  value: number | number[] | Float32Array,
) {
  if (location == null) return;
  if (typeof value === "number") {
    gl.uniform1f(location, value);
  } else if (Array.isArray(value) || value instanceof Float32Array) {
    switch (value.length) {
      case 1:
        gl.uniform1fv(location, value);
        break;
      case 2:
        gl.uniform2fv(location, value);
        break;
      case 3:
        gl.uniform3fv(location, value);
        break;
      case 4:
        gl.uniform4fv(location, value);
        break;
      default:
        // fallback: upload as float array
        gl.uniform1fv(location, value as Float32Array);
        break;
    }
  }
}
