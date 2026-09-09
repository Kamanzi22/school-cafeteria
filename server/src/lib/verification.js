const crypto = require('crypto');
const prisma = require('./prisma');

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const genCode = () => String(crypto.randomInt(100000, 1000000));

// restaurant_* purposes are scoped by restaurantId (from the authenticated session, never
// client input); customer_signup has no account yet, so it's scoped by the email itself.
const scopeWhere = (purpose, { email, restaurantId }) => restaurantId
  ? { purpose, restaurantId, consumedAt: null }
  : { purpose, email: email.toLowerCase(), restaurantId: null, consumedAt: null };

async function createVerification({ email, purpose, payload, restaurantId }) {
  // A fresh request supersedes any still-pending code for the same purpose/subject.
  await prisma.verificationCode.updateMany({ where: scopeWhere(purpose, { email, restaurantId }), data: { consumedAt: new Date() } });

  const code = genCode();
  await prisma.verificationCode.create({
    data: {
      email: email.toLowerCase(),
      purpose,
      restaurantId: restaurantId || null,
      codeHash: sha256(code),
      payload: payload ? JSON.stringify(payload) : null,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return { code };
}

// Returns { payload } on success or { error: 'expired' | 'invalid' | 'too_many_attempts' }.
async function consumeVerification({ purpose, email, restaurantId, code }) {
  const row = await prisma.verificationCode.findFirst({
    where: { ...scopeWhere(purpose, { email, restaurantId }), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return { error: 'expired' };
  if (row.attempts >= MAX_ATTEMPTS) return { error: 'too_many_attempts' };

  const ok = sha256(code || '') === row.codeHash;
  if (!ok) {
    await prisma.verificationCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { error: 'invalid' };
  }
  await prisma.verificationCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { payload: row.payload ? JSON.parse(row.payload) : null };
}

const VERIFY_ERROR_MESSAGES = {
  invalid: 'Incorrect code',
  too_many_attempts: 'Too many attempts — request a new code',
  expired: 'Code expired — request a new one',
};

module.exports = { createVerification, consumeVerification, VERIFY_ERROR_MESSAGES };
