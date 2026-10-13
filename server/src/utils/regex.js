/**
 * Build a case-insensitive "contains" regex from user input.
 * Escaping stops a search like "(a+)+$" from being run as a pattern (ReDoS / injection).
 */
function containsRegex(input) {
  const text = String(input || '').slice(0, 100);
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

module.exports = { containsRegex };
