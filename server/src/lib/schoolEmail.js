// Customer accounts are limited to school-issued addresses.
const SCHOOL_EMAIL_DOMAINS = ['alustudent.com', 'alueducation.com'];

const isSchoolEmail = (email) => {
  const domain = String(email || '').trim().toLowerCase().split('@')[1];
  return SCHOOL_EMAIL_DOMAINS.includes(domain);
};

const SCHOOL_EMAIL_ERROR = `Please use your school email (${SCHOOL_EMAIL_DOMAINS.map(d => '@' + d).join(' or ')})`;

module.exports = { isSchoolEmail, SCHOOL_EMAIL_ERROR };
