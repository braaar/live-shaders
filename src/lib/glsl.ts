// utilities for converting "bonzomatic" and Shadertoy fragments into WebGL2-compatible GLSL

export type GLSLToken = {
  type: string;
  text: string;
  isIntegerLiteral?: boolean;
};

export function tokenizeGLSL(src: string): GLSLToken[] {
  const tokens: GLSLToken[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      let j = i + 1;
      while (
        j < src.length &&
        (src[j] === " " ||
          src[j] === "\t" ||
          src[j] === "\r" ||
          src[j] === "\n")
      )
        j += 1;
      tokens.push({ type: "ws", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === "/" && src[i + 1] === "/") {
      let j = i + 2;
      while (j < src.length && src[j] !== "\n") j += 1;
      tokens.push({ type: "comment", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === "/" && src[i + 1] === "*") {
      let j = i + 2;
      while (j < src.length && !(src[j] === "*" && src[j + 1] === "/"))
        j += 1;
      j = Math.min(src.length, j + 2);
      tokens.push({ type: "comment", text: src.slice(i, j) });
      i = j;
      continue;
    }

    const lineStart = i === 0 || src[i - 1] === "\n";
    if (lineStart) {
      let k = i;
      while (k < src.length && (src[k] === " " || src[k] === "\t")) k += 1;
      if (src[k] === "#") {
        let j = k + 1;
        while (j < src.length && src[j] !== "\n") j += 1;
        if (k > i) tokens.push({ type: "ws", text: src.slice(i, k) });
        tokens.push({ type: "preproc", text: src.slice(k, j) });
        i = j;
        continue;
      }
    }

    if (
      (ch >= "A" && ch <= "Z") ||
      (ch >= "a" && ch <= "z") ||
      ch === "_"
    ) {
      let j = i + 1;
      while (j < src.length) {
        const c = src[j];
        const isWord =
          (c >= "A" && c <= "Z") ||
          (c >= "a" && c <= "z") ||
          (c >= "0" && c <= "9") ||
          c === "_";
        if (!isWord) break;
        j += 1;
      }
      tokens.push({ type: "ident", text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (
      (ch >= "0" && ch <= "9") ||
      (ch === "." && src[i + 1] >= "0" && src[i + 1] <= "9")
    ) {
      let j = i;
      let hasDot = false;
      let hasExp = false;

      if (src[j] === ".") {
        hasDot = true;
        j += 1;
      }

      while (j < src.length && src[j] >= "0" && src[j] <= "9") j += 1;
      if (src[j] === ".") {
        hasDot = true;
        j += 1;
        while (j < src.length && src[j] >= "0" && src[j] <= "9") j += 1;
      }
      if (src[j] === "e" || src[j] === "E") {
        hasExp = true;
        j += 1;
        if (src[j] === "+" || src[j] === "-") j += 1;
        while (j < src.length && src[j] >= "0" && src[j] <= "9") j += 1;
      }

      tokens.push({
        type: "number",
        text: src.slice(i, j),
        isIntegerLiteral: !hasDot && !hasExp,
      });
      i = j;
      continue;
    }

    const two = src.slice(i, i + 2);
    if (
      [
        "<=",
        ">=",
        "==",
        "!=",
        "&&",
        "||",
        "++",
        "--",
        "+=",
        "-=",
        "*=",
        "/=",
        "%=",
      ].includes(two)
    ) {
      tokens.push({ type: "punct", text: two });
      i += 2;
      continue;
    }

    if ("(){}[];,:+-*/%<>=!?".includes(ch)) {
      tokens.push({ type: "punct", text: ch });
      i += 1;
      continue;
    }

    tokens.push({ type: "other", text: ch });
    i += 1;
  }

  return tokens;
}

export function bonzomaticFloatLiteralPass(src: string): string {
  const tokens = tokenizeGLSL(src);
  const sigIndices = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const type = tokens[i].type;
    if (type !== "ws" && type !== "comment") sigIndices.push(i);
  }

  const sigPos = new Map();
  for (let i = 0; i < sigIndices.length; i += 1) sigPos.set(sigIndices[i], i);

  const intTypeKeywords = new Set([
    "int",
    "ivec2",
    "ivec3",
    "ivec4",
    "uint",
    "uvec2",
    "uvec3",
    "uvec4",
  ]);
  const relationalOps = new Set(["<", ">", "<=", ">=", "==", "!="]);

  let squareDepth = 0;
  let layoutDepth = 0;
  let pendingLayoutParen = false;
  let intDeclDepth = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];

    if (tok.type === "ident" && tok.text === "layout") {
      pendingLayoutParen = true;
    }

    if (tok.type === "punct") {
      if (tok.text === "(") {
        if (pendingLayoutParen) {
          layoutDepth += 1;
          pendingLayoutParen = false;
        } else if (layoutDepth > 0) {
          layoutDepth += 1;
        }
      } else if (tok.text === ")") {
        if (layoutDepth > 0) layoutDepth -= 1;
      } else if (tok.text === "[") {
        squareDepth += 1;
      } else if (tok.text === "]") {
        if (squareDepth > 0) squareDepth -= 1;
      } else if (tok.text === ";") {
        intDeclDepth = 0;
      }
    }

    if (tok.type === "ident" && intTypeKeywords.has(tok.text)) {
      intDeclDepth += 1;
    }

    if (tok.type !== "number" || !tok.isIntegerLiteral) continue;
    if (squareDepth > 0 || layoutDepth > 0 || intDeclDepth > 0) continue;

    const pos = sigPos.get(i);
    const prev = pos > 0 ? tokens[sigIndices[pos - 1]] : null;
    const next =
      pos < sigIndices.length - 1 ? tokens[sigIndices[sigIndices.length - 1]] : null;

    if (
      (prev && relationalOps.has(prev.text)) ||
      (next && relationalOps.has(next.text))
    )
      continue;

    const prevText = prev ? prev.text : "";
    const nextText = next ? next.text : "";

    const looksLikeFloatContext =
      ["=", "+", "-", "*", "/", "%", "(", ",", ":", "?", "return"].includes(
        prevText,
      ) ||
      ["+", "-", "*", "/", "%", ")", ",", ";", "}", ":", "?"].includes(
        nextText,
      );

    if (!looksLikeFloatContext) continue;

    tok.text = `${tok.text}.0`;
    tok.isIntegerLiteral = false;
  }

  return tokens.map((t) => t.text).join("");
}

export function bonzomaticToWebGL2(src: string): string {
  let out = src;
  out = out.replace(/^\s*#version\s+[^\n]*\n?/m, "");
  out = out.replace(
    /uniform\s+sampler1D\s+(\w+)\s*;/g,
    "uniform sampler2D $1;",
  );
  out = out.replace(
    /texture\s*\(\s*(texFFT|texFFTSmoothed|texFFTIntegrated)\s*,/g,
    "texture1D($1,",
  );
  out = bonzomaticFloatLiteralPass(out);

  const header = `#version 300 es
precision highp float;
precision highp int;

vec4 texture1D(sampler2D t, float x) {
  return texture(t, vec2(x, 0.5));
}

`;

  return `${header}${out}`;
}

export function shadertoyToWebGL2(src: string): string {
  let out = src;
  out = out.replace(/^\s*#version\s+[^\n]*\n?/m, "");
  out = out.replace(/\btexture2D\s*\(/g, "texture(");
  out = out.replace(/\btextureCube\s*\(/g, "texture(");

  if (/\bgl_FragColor\b/.test(out)) {
    out = out.replace(/\bgl_FragColor\b/g, "out_color");
  }

  const hasMainImage = /void\s+mainImage\s*\(/.test(out);
  const hasMain = /void\s+main\s*\(/.test(out);

  const header = `#version 300 es
precision highp float;
precision highp int;

uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

layout(location = 0) out vec4 out_color;

`;

  const mainWrapper =
    hasMainImage && !hasMain
      ? `
void main() {
  mainImage(out_color, gl_FragCoord.xy);
}
`
      : "";

  return `${header}${out}${mainWrapper}`;
}

export function prepareFragmentSource(src: string): { source: string; profile: "shadertoy" | "bonzomatic" } {
  const isShadertoy =
    /mainImage\s*\(/.test(src) ||
    /\biResolution\b|\biTime\b|\biChannel[0-3]\b/.test(src);
  if (isShadertoy) {
    return {
      source: shadertoyToWebGL2(src),
      profile: "shadertoy",
    };
  }
  return {
    source: bonzomaticToWebGL2(src),
    profile: "bonzomatic",
  };
}
