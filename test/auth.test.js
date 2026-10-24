const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(file, dependencies, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, exports: module.exports, require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`);
      return dependencies[name];
    }, process: { env }, console: { error() {} }, Buffer, Date, URL
  });
  return module.exports;
}
function request(body = {}) {
  return { body, session: {}, messages: [], flash(type, message) { this.messages.push({ type, message }); } };
}
function controller(user = {}, send = async () => {}) {
  return load('controllers/authController.js', {
    bcrypt: { hash: async () => 'hash', compare: async () => true },
    crypto: { randomInt: () => 123456 },
    '../models/User': user,
    '../middleware/auth': { staffHome: () => '/dashboard' },
    '../services/emailService': { sendVerificationCode: send }
  });
}
test('Gmail App Password spaces and sender whitespace are removed', async () => {
  let config;
  const service = load('services/emailService.js', { nodemailer: { createTransport: (value) => {
    config = value; return { verify: async () => true };
  } } }, { EMAIL_USER: ' sender@gmail.com ', EMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' });
  await service.verifyEmailConfiguration();
  assert.equal(config.auth.user, 'sender@gmail.com');
  assert.equal(config.auth.pass, 'abcdefghijklmnop');
});
test('missing mail credentials fail before transport creation', async () => {
  const service = load('services/emailService.js', { nodemailer: { createTransport() { throw Error('unexpected'); } } });
  await assert.rejects(service.verifyEmailConfiguration(), /Gmail App Password/);
});
test('failed registration email keeps account recoverable on verification page', async () => {
  let deleted = false;
  const c = controller({ findByEmail: async () => null, create: async () => ({ id: 1, email: 'a.b@gmail.com' }),
    createVerificationCode: async () => {}, deleteVerificationCode: async () => { deleted = true; }
  }, async () => { throw Error('EAUTH'); });
  const req = request({ name: 'Test User', email: 'a.b@gmail.com', password: 'Password123', role: 'student' });
  let destination;
  await c.register(req, { redirect: (url) => { destination = url; } }, (err) => { throw err; });
  assert.equal(destination, '/auth/verify?email=a.b%40gmail.com');
  assert.equal(deleted, true);
});
test('repeat registration respects verification resend cooldown', async () => {
  const c = controller({ findByEmail: async () => ({ id: 1, is_verified: false }),
    getVerificationCode: async () => ({ last_sent_at: new Date() })
  }, async () => { throw Error('must not send'); });
  const req = request({ name: 'Test User', email: 'test@gmail.com', password: 'Password123', role: 'student' });
  await c.register(req, { redirect() {} }, (err) => { throw err; });
  assert.match(req.messages[0].message, /one minute/);
});
test('login propagates session store errors instead of redirecting as success', async () => {
  const error = Error('database unavailable');
  const c = controller({ findByEmail: async () => ({ id: 1, name: 'Test User', role: 'student', is_active: true, is_verified: true }) });
  const req = request({ email: 'test@gmail.com', password: 'Password123' });
  req.session.save = (callback) => callback(error);
  let failure;
  await c.login(req, { redirect() { throw Error('must not redirect'); } }, (err) => { failure = err; });
  assert.equal(failure, error);
});
test('validation keeps dotted Gmail and plus aliases unchanged', () => {
  const sanitizers = [];
  const chain = new Proxy({}, { get: (_, key) => (...args) => {
    if (key === 'customSanitizer') sanitizers.push(args[0]);
    return chain;
  } });
  load('middleware/validation.js', { 'express-validator': { body: () => chain, query: () => chain } });
  assert.equal(sanitizers.length, 3);
  for (const sanitize of sanitizers) assert.equal(sanitize('A.B+Class@gmail.com'), 'a.b+class@gmail.com');
});
