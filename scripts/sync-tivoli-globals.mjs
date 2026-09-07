// Runtime compatibility helpers for the sync script.
// The route normalizer uses normalizeColor(); expose it globally so the
// existing sync module can run unchanged in Node.js.
globalThis.normalizeColor = function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color.toLowerCase() : '';
};
