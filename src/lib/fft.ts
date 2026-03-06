/**
 * Utilities for working with the Web Audio API's analyser node.  This file
 * started out empty but now holds some simple helpers so the rest of the
 * application can be kept small and focused.
 */

/**
 * Default number of bins used for frequency analysis.  Bonzomatic output
 * shaders tend to expect 1024 values in the traditional demo‑scene setups.
 */
export const FFT_BIN_COUNT = 1024;

/**
 * Create an analyser node with a sensible default fftSize.  The caller is
 * responsible for connecting it to the audio graph.
 */
export function createAnalyser(
  context: AudioContext,
  fftSize: number = FFT_BIN_COUNT,
): AnalyserNode {
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  return analyser;
}

/**
 * Grab a snapshot of the current frequency-domain data from an analyser.
 */
export function getFrequencyData(analyser: AnalyserNode): Float32Array {
  const data = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(data);
  return data;
}

/**
 * Grab the time‑domain audio samples from an analyser node.
 */
export function getTimeDomainData(analyser: AnalyserNode): Float32Array {
  const data = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatTimeDomainData(data);
  return data;
}
