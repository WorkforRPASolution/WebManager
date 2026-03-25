/**
 * Shared validation patterns used across multiple feature validation modules
 */
const patterns = {
  // Korean character detection (Hangul syllables, Jamo, compatibility Jamo)
  korean: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/,
  // Allowed characters: alphanumeric, dot, underscore only
  allowedBasic: /^[A-Za-z0-9._]*$/,
  // Allowed characters: alphanumeric, dot, underscore, dash
  allowedWithDash: /^[A-Za-z0-9._-]*$/,
  // Email pattern
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Strict IPv4 with octet range check (0-255)
  ipStrict: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  // Date format YYYY-MM-DD
  date: /^\d{4}-\d{2}-\d{2}$/
}

module.exports = patterns
