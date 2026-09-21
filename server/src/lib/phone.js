// Accepts "+250 788 123 456", "0788-123-456", "(078) 8123456" etc.; returns the digits with an
// optional leading "+", or null if it doesn't look like a phone number (9–15 digits).
const normalizePhone = (raw) => {
  const p = String(raw || '').replace(/[\s\-().]/g, '');
  return /^\+?\d{9,15}$/.test(p) ? p : null;
};

module.exports = { normalizePhone };
