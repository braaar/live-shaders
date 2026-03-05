import {
  FFT_BIN_COUNT,
  FFT_SAMPLE_COUNT,
  FFT_SMOOTH_FACTOR,
  FFT_SLIGHT_SMOOTH_FACTOR,
  FFT_PEAK_NORMALIZATION,
  FFT_PEAK_MIN_VALUE,
  FFT_PEAK_SMOOTHING,
  LEGACY_FFT_OUTPUT_GAIN,
  LEGACY_FFT_RAW_BASELINE_SMOOTHING,
  LEGACY_FFT_RAW_BASELINE_SUBTRACT,
  LEGACY_FFT_MAX_AMPLIFICATION,
  FFT_INTEGRATED_SCALE,
  FFT_INTEGRATED_WRAP,
  LEGACY_FFT_INTEGRATED_BASELINE_SMOOTHING,
  LEGACY_FFT_INTEGRATED_DYNAMIC_GAIN,
} from "./constants.ts";

// audio system helper functions

type AudioSystem = {
  audio: HTMLMediaElement;
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  freq: Float32Array | null;
  timeDomain: Float32Array;
  fftScratchReal: Float32Array;
  fftScratchImag: Float32Array;
  fftMagnitudes: Float32Array;
  raw: Float32Array;
  rawBaseline: Float32Array;
  rawBaselineInitialized: boolean;
  smooth: Float32Array;
  slightlySmooth: Float32Array;
  integratedBaseline: Float32Array;
  integratedState: Float32Array;
  integrated: Float32Array;
  amplification: number;
  peakLevel: number;
  graphInitTried: boolean;
  ensureGraph?: () => Promise<void>;
};

let audioSystemPromise: Promise<AudioSystem | null> | null = null;
let audioUnlockedByGesture = false;
let fftPipelineMode: "bonzomatic" | "legacy" = "bonzomatic";

export function getAudioState() {
  return {
    audioSystemPromise,
    audioUnlockedByGesture,
    fftPipelineMode,
  };
}

export function setFftMode(mode: "bonzomatic" | "legacy") {
  fftPipelineMode = mode;
}

export function getFftMode(): "bonzomatic" | "legacy" {
  return fftPipelineMode;
}

export function isAudioUnlocked(): boolean {
  return audioUnlockedByGesture;
}

export function markAudioUnlocked(): void {
  audioUnlockedByGesture = true;
}

export async function getAudioSystem(musicUrl: string | null): Promise<AudioSystem | null> {
  if (audioSystemPromise) return audioSystemPromise;

  audioSystemPromise = (async () => {
    if (!musicUrl) return null;

    const audio = new Audio(musicUrl);
    audio.loop = true;
    audio.autoplay = true;
    audio.muted = true;
    audio.playsInline = true;
    try {
      await audio.play();
    } catch {}

    const system = {
      audio,
      context: null,
      analyser: null,
      freq: null,
      timeDomain: new Float32Array(FFT_SAMPLE_COUNT),
      fftScratchReal: new Float32Array(FFT_SAMPLE_COUNT),
      fftScratchImag: new Float32Array(FFT_SAMPLE_COUNT),
      fftMagnitudes: new Float32Array(FFT_BIN_COUNT),
      raw: new Float32Array(FFT_BIN_COUNT),
      rawBaseline: new Float32Array(FFT_BIN_COUNT),
      rawBaselineInitialized: false,
      smooth: new Float32Array(FFT_BIN_COUNT),
      slightlySmooth: new Float32Array(FFT_BIN_COUNT),
      integratedBaseline: new Float32Array(FFT_BIN_COUNT),
      integratedState: new Float32Array(FFT_BIN_COUNT),
      integrated: new Float32Array(FFT_BIN_COUNT),
      amplification: 1,
      peakLevel: FFT_PEAK_MIN_VALUE,
      graphInitTried: false,
    };

    system.ensureGraph = async () => {
      if (system.analyser || system.graphInitTried) return;
      system.graphInitTried = true;

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const context = new AudioCtx();
        const source = context.createMediaElementSource(system.audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SAMPLE_COUNT;
        analyser.smoothingTimeConstant = 0;

        source.connect(analyser);
        analyser.connect(context.destination);

        system.context = context;
        system.analyser = analyser;
        system.freq = new Float32Array(analyser.frequencyBinCount);
      } catch {
        system.graphInitTried = false;
      }
    };

    return system;
  })();

  return audioSystemPromise;
}

export async function ensureAudioRunning(audioSystem: AudioSystem | null): Promise<void> {
  if (!audioSystem) return;

  if (audioSystem.ensureGraph) {
    try {
      await audioSystem.ensureGraph();
    } catch {}
  }

  if (audioSystem.context && audioSystem.context.state !== "running") {
    try {
      await audioSystem.context.resume();
    } catch {}
  }

  if (audioSystem.audio.paused) {
    try {
      await audioSystem.audio.play();
    } catch {}
  }
}

export function computeBonzomaticFFT(
  samples: Float32Array,
  realScratch: Float32Array,
  imagScratch: Float32Array,
  outBins: Float32Array,
): void {
  const n = FFT_SAMPLE_COUNT;

  for (let i = 0; i < n; i += 1) {
    realScratch[i] = samples[i] || 0;
    imagScratch[i] = 0;
  }

  let j = 0;
  for (let i = 1; i < n; i += 1) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = realScratch[i];
      realScratch[i] = realScratch[j];
      realScratch[j] = tr;

      const ti = imagScratch[i];
      imagScratch[i] = imagScratch[j];
      imagScratch[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const theta = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(theta);
    const wStepIm = Math.sin(theta);

    for (let start = 0; start < n; start += len) {
      let wRe = 1;
      let wIm = 0;

      for (let k = 0; k < half; k += 1) {
        const evenIndex = start + k;
        const oddIndex = evenIndex + half;

        const oddRe = realScratch[oddIndex];
        const oddIm = imagScratch[oddIndex];

        const tRe = wRe * oddRe - wIm * oddIm;
        const tIm = wRe * oddIm + wIm * oddRe;

        const evenRe = realScratch[evenIndex];
        const evenIm = imagScratch[evenIndex];

        realScratch[evenIndex] = evenRe + tRe;
        imagScratch[evenIndex] = evenIm + tIm;
        realScratch[oddIndex] = evenRe - tRe;
        imagScratch[oddIndex] = evenIm - tIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        const nextWIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
        wIm = nextWIm;
      }
    }
  }

  for (let i = 0; i < FFT_BIN_COUNT; i += 1) {
    const re = realScratch[i];
    const im = imagScratch[i];
    outBins[i] = 2 * Math.sqrt(re * re + im * im);
  }
}

export function sampleAudioFFT(audioSystem: AudioSystem | null, dt: number): { raw: Float32Array; smooth: Float32Array; integrated: Float32Array } {
  if (!audioSystem) {
    return {
      raw: new Float32Array(FFT_BIN_COUNT),
      smooth: new Float32Array(FFT_BIN_COUNT),
      integrated: new Float32Array(FFT_BIN_COUNT),
    };
  }

  const {
    analyser,
    freq,
    timeDomain,
    fftScratchReal,
    fftScratchImag,
    fftMagnitudes,
    raw,
    rawBaseline,
    smooth,
    slightlySmooth,
    integratedBaseline,
    integratedState,
    integrated,
  } = audioSystem;
  if (analyser && freq) {
    if (fftPipelineMode === "legacy") {
      analyser.getFloatFrequencyData(freq);
    } else {
      analyser.getFloatTimeDomainData(timeDomain);
      computeBonzomaticFFT(
        timeDomain,
        fftScratchReal,
        fftScratchImag,
        fftMagnitudes,
      );
    }

    let framePeak = FFT_PEAK_MIN_VALUE;
    for (let i = 0; i < raw.length; i += 1) {
      const magnitude =
        fftPipelineMode === "legacy"
          ? Number.isFinite(freq[i])
            ? Math.pow(10, freq[i] / 20) * 2
            : 0
          : fftMagnitudes[i] || 0;
      if (magnitude > framePeak) framePeak = magnitude;

      if (fftPipelineMode === "legacy") {
        let value =
          magnitude * audioSystem.amplification * LEGACY_FFT_OUTPUT_GAIN;
        if (i === 0) value *= 0.35;
        else if (i === 1) value *= 0.65;
        raw[i] = Math.min(1, value);
      } else {
        raw[i] = magnitude * audioSystem.amplification;
      }
    }

    if (FFT_PEAK_NORMALIZATION) {
      if (framePeak > audioSystem.peakLevel) {
        audioSystem.peakLevel = framePeak;
      } else {
        audioSystem.peakLevel =
          audioSystem.peakLevel * FFT_PEAK_SMOOTHING +
          framePeak * (1 - FFT_PEAK_SMOOTHING);
        if (audioSystem.peakLevel < FFT_PEAK_MIN_VALUE) {
          audioSystem.peakLevel = FFT_PEAK_MIN_VALUE;
        }
      }

      if (fftPipelineMode === "legacy") {
        audioSystem.amplification = Math.min(
          LEGACY_FFT_MAX_AMPLIFICATION,
          1 / audioSystem.peakLevel,
        );
      } else {
        audioSystem.amplification = 1 / audioSystem.peakLevel;
      }
    }

    if (fftPipelineMode === "legacy") {
      if (!audioSystem.rawBaselineInitialized) {
        for (let i = 0; i < raw.length; i += 1) {
          rawBaseline[i] = raw[i];
        }
        audioSystem.rawBaselineInitialized = true;
      }

      for (let i = 0; i < raw.length; i += 1) {
        rawBaseline[i] =
          rawBaseline[i] * LEGACY_FFT_RAW_BASELINE_SMOOTHING +
          raw[i] * (1 - LEGACY_FFT_RAW_BASELINE_SMOOTHING);
        raw[i] = Math.max(
          0,
          raw[i] - rawBaseline[i] * LEGACY_FFT_RAW_BASELINE_SUBTRACT,
        );
      }
    }
  } else {
    raw.fill(0);
  }

  const integratedScale = dt * FFT_INTEGRATED_SCALE;
  for (let i = 0; i < smooth.length; i += 1) {
    smooth[i] =
      smooth[i] * FFT_SMOOTH_FACTOR + raw[i] * (1 - FFT_SMOOTH_FACTOR);
    slightlySmooth[i] =
      slightlySmooth[i] * FFT_SLIGHT_SMOOTH_FACTOR +
      raw[i] * (1 - FFT_SLIGHT_SMOOTH_FACTOR);

    if (fftPipelineMode === "legacy") {
      integratedBaseline[i] =
        integratedBaseline[i] * LEGACY_FFT_INTEGRATED_BASELINE_SMOOTHING +
        slightlySmooth[i] * (1 - LEGACY_FFT_INTEGRATED_BASELINE_SMOOTHING);
      const dynamic = Math.max(0, slightlySmooth[i] - integratedBaseline[i]);
      integratedState[i] =
        integratedState[i] +
        dynamic * integratedScale * LEGACY_FFT_INTEGRATED_DYNAMIC_GAIN;
    } else {
      integratedState[i] = integratedState[i] + slightlySmooth[i] * integratedScale;
    }

    if (integratedState[i] > FFT_INTEGRATED_WRAP) {
      integratedState[i] -= FFT_INTEGRATED_WRAP;
    }
    integrated[i] =
      fftPipelineMode === "legacy"
        ? integratedState[i] / FFT_INTEGRATED_WRAP
        : integratedState[i];
  }

  return { raw, smooth, integrated };
}

export function formatFFTPreview(data: Float32Array | null | undefined): string {
  if (!data || !data.length) return "n/a";
  const a = data[0] || 0;
  const b = data[8] || 0;
  const c = data[32] || 0;
  const d = data[96] || 0;
  return [a, b, c, d].map((v) => v.toFixed(3)).join(", ");
}

export function computeFFTStats(data: Float32Array | null | undefined): { max: number; avg: number } {
  if (!data || !data.length) return { max: 0, avg: 0 };
  let max = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i] || 0;
    if (v > max) max = v;
    sum += v;
  }
  return { max, avg: sum / data.length };
}

export function updateAudioDebug(
  audioSystem: AudioSystem | null,
  fftData: { raw: Float32Array; smooth: Float32Array; integrated: Float32Array },
  instances: any[],
  now: number,
  musicFile: string | null,
): void {
  const debugEl = document.getElementById("audio-debug");
  if (!debugEl) return;
  if (now - lastDebugUpdate < 150) return;
  lastDebugUpdate = now;

  const fftUsingShaders = instances.filter((x) => x && x.usesTexFFT).length;
  const smoothUsingShaders = instances.filter(
    (x) => x && x.usesTexFFTSmoothed,
  ).length;
  const integratedUsingShaders = instances.filter(
    (x) => x && x.usesTexFFTIntegrated,
  ).length;

  if (!audioSystem) {
    debugEl.textContent = [
      "Audio debug",
      "audioSystem: none",
      `shader texFFT uniforms: ${fftUsingShaders}/${instances.length}`,
    ].join("\n");
    return;
  }

  const rawStats = computeFFTStats(fftData.raw);
  const smoothStats = computeFFTStats(fftData.smooth);
  const contextState = audioSystem.context
    ? audioSystem.context.state
    : "none";
  const analyserReady = audioSystem.analyser ? "yes" : "no";
  const paused = audioSystem.audio ? String(audioSystem.audio.paused) : "n/a";
  const muted = audioSystem.audio ? String(audioSystem.audio.muted) : "n/a";
  const currentTime = audioSystem.audio
    ? audioSystem.audio.currentTime.toFixed(2)
    : "0.00";
  const peakLevel =
    typeof audioSystem.peakLevel === "number"
      ? audioSystem.peakLevel.toFixed(3)
      : "n/a";

  debugEl.textContent = [
    "Audio debug",
    `track: ${musicFile || "none"}`,
    `fft mode: ${fftPipelineMode}`,
    `gestureUnlocked: ${audioUnlockedByGesture}`,
    `context: ${contextState} | analyser: ${analyserReady}`,
    `peakLevel: ${peakLevel}`,
    `audio paused: ${paused} | muted: ${muted} | t: ${currentTime}s`,
    `raw max/avg: ${rawStats.max.toFixed(3)} / ${rawStats.avg.toFixed(3)}`,
    `smooth max/avg: ${smoothStats.max.toFixed(3)} / ${smoothStats.avg.toFixed(3)}`,
    `raw bins [0,8,32,96]: ${formatFFTPreview(fftData.raw)}`,
    `shader texFFT uniforms: ${fftUsingShaders}/${instances.length}`,
    `shader texFFTSmoothed uniforms: ${smoothUsingShaders}/${instances.length}`,
    `shader texFFTIntegrated uniforms: ${integratedUsingShaders}/${instances.length}`,
  ].join("\n");
}

let lastDebugUpdate = 0;

export function setupAudioToggle(audioSystem: AudioSystem | null, musicFile: string | null): void {
  const toggle = document.getElementById("audio-toggle");
  const trackEl = document.getElementById("audio-track");

  if (trackEl) {
    if (musicFile) {
      const fileName = musicFile.split("/").pop() || musicFile;
      trackEl.textContent = `Track: ${fileName}`;
    } else {
      trackEl.textContent = "Track: none";
    }
  }

  if (!toggle) return;

  if (!audioSystem) {
    toggle.disabled = true;
    toggle.textContent = "No music file";
    return;
  }

  const unlockAudio = () => {
    markAudioUnlocked();
    ensureAudioRunning(audioSystem);
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };

  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });

  const syncText = () => {
    toggle.textContent = audioSystem.audio.muted
      ? "Start music"
      : "Mute music";
  };

  toggle.addEventListener("click", async () => {
    markAudioUnlocked();
    await ensureAudioRunning(audioSystem);

    audioSystem.audio.muted = !audioSystem.audio.muted;
    syncText();
  });

  syncText();
}

export function setupFFTModeToggle(): void {
  const toggle = document.getElementById("fft-mode-toggle");
  if (!toggle) return;

  const syncText = () => {
    toggle.textContent =
      fftPipelineMode === "bonzomatic"
        ? "FFT mode: Bonzomatic"
        : "FFT mode: Legacy";
  };

  toggle.addEventListener("click", () => {
    fftPipelineMode =
      fftPipelineMode === "bonzomatic" ? "legacy" : "bonzomatic";
    syncText();
  });

  syncText();
}
