// The ordinal level palette lives in @klicker-uzh/adaptive-contract so the
// manage editor (defaults, preview, contrast hint) and the student views use
// the same mapping. Bands may carry a lecturer-chosen `color` override.
export {
  ADAPTIVE_COMPETENCE_MARKER_COLORS,
  ADAPTIVE_LEVEL_MARKER_COLOR,
  ADAPTIVE_LEVEL_MIN_MARKER_CONTRAST,
  type AdaptiveLevelColorSpec,
  type AdaptiveLevelPaletteBand,
  contrastRatio,
  getAdaptiveLevelBandColors,
  getAdaptiveLevelColorSpecs,
  getAdaptiveLevelColors,
  getAdaptiveLevelGroupEnds,
  hasAdaptiveLevelMarkerContrast,
  oklchToHex,
  relativeLuminance,
} from '@klicker-uzh/adaptive-contract'
