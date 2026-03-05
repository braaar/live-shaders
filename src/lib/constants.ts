// Shared numeric parameters used across audio and WebGL utilities
export const FFT_BIN_COUNT = 1024;
export const FFT_SAMPLE_COUNT = FFT_BIN_COUNT * 2;
export const FFT_SMOOTH_FACTOR = 0.9;
export const FFT_SLIGHT_SMOOTH_FACTOR = 0.6;
export const FFT_PEAK_NORMALIZATION = true;
export const FFT_PEAK_MIN_VALUE = 0.01;
export const FFT_PEAK_SMOOTHING = 0.995;
export const LEGACY_FFT_OUTPUT_GAIN = 0.45;
export const LEGACY_FFT_RAW_BASELINE_SMOOTHING = 0.9;
export const LEGACY_FFT_RAW_BASELINE_SUBTRACT = 1.0;
export const LEGACY_FFT_MAX_AMPLIFICATION = 4.0;
export const FFT_INTEGRATED_SCALE = 60.0;
export const FFT_INTEGRATED_WRAP = 1024.0;
export const LEGACY_FFT_INTEGRATED_BASELINE_SMOOTHING = 0.995;
export const LEGACY_FFT_INTEGRATED_DYNAMIC_GAIN = 2.0;
