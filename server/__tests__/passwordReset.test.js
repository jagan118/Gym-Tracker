const mockUserFindOne = jest.fn();
const mockPasswordResetFindOne = jest.fn();
const mockPasswordResetFindOneAndUpdate = jest.fn();
const mockPasswordResetFindOneAndDelete = jest.fn();
const mockPasswordResetUpdateOne = jest.fn();
const mockPasswordResetDeleteOne = jest.fn();
const mockIsSmtpConfigured = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

jest.mock('../models/User', () => ({
  findOne: (...args) => mockUserFindOne(...args),
}));

jest.mock('../models/PasswordReset', () => ({
  findOne: (...args) => mockPasswordResetFindOne(...args),
  findOneAndUpdate: (...args) => mockPasswordResetFindOneAndUpdate(...args),
  findOneAndDelete: (...args) => mockPasswordResetFindOneAndDelete(...args),
  updateOne: (...args) => mockPasswordResetUpdateOne(...args),
  deleteOne: (...args) => mockPasswordResetDeleteOne(...args),
}));

jest.mock('../utils/sendPasswordResetEmail', () => ({
  isSmtpConfigured: (...args) => mockIsSmtpConfigured(...args),
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
}));

const { createHmac } = require('crypto');
const { requestPasswordReset, resetPassword } = require('../controllers/authController');

const makeResponse = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

describe('Email OTP password reset', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-reset-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSmtpConfigured.mockReturnValue(true);
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('returns the generic response without emailing an unknown account', async () => {
    mockUserFindOne.mockResolvedValue(null);
    const res = makeResponse();
    const next = jest.fn();

    await requestPasswordReset({ body: { email: 'unknown@example.com' } }, res, next);

    expect(res.body).toMatchObject({ success: true });
    expect(res.body.message).toMatch(/if an account exists/i);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('sends a six-digit code and stores only its HMAC digest', async () => {
    mockUserFindOne.mockResolvedValue({ email: 'member@example.com' });
    mockPasswordResetFindOne.mockResolvedValue(null);
    const res = makeResponse();
    const next = jest.fn();

    await requestPasswordReset({ body: { email: 'member@example.com' } }, res, next);

    const [email, code] = mockSendPasswordResetEmail.mock.calls[0];
    const update = mockPasswordResetFindOneAndUpdate.mock.calls[0][1].$set;
    expect(email).toBe('member@example.com');
    expect(code).toMatch(/^\d{6}$/);
    expect(update.codeHash).toBe(
      createHmac('sha256', process.env.JWT_SECRET)
        .update(`${email}:${code}`)
        .digest('hex')
    );
    expect(update.codeHash).not.toBe(code);
    expect(update.attempts).toBe(0);
    expect(res.body.success).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not send another code during the resend cooldown', async () => {
    mockUserFindOne.mockResolvedValue({ email: 'member@example.com' });
    mockPasswordResetFindOne.mockResolvedValue({ lastSentAt: new Date() });
    const res = makeResponse();
    const next = jest.fn();

    await requestPasswordReset({ body: { email: 'member@example.com' } }, res, next);

    expect(res.body.success).toBe(true);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockPasswordResetFindOneAndUpdate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('increments attempts after an incorrect code', async () => {
    const reset = { _id: 'reset-id', codeHash: '0'.repeat(64), attempts: 0 };
    mockPasswordResetFindOne.mockResolvedValue(reset);
    const res = makeResponse();
    const next = jest.fn();

    await resetPassword(
      { body: { email: 'member@example.com', code: '123456', password: 'password-123' } },
      res,
      next
    );

    expect(res.statusCode).toBe(400);
    expect(mockPasswordResetUpdateOne).toHaveBeenCalledWith(
      { _id: reset._id, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } }
    );
    expect(mockUserFindOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects expired codes before looking up the account', async () => {
    mockPasswordResetFindOne.mockResolvedValue(null);
    const res = makeResponse();
    const next = jest.fn();

    await resetPassword(
      { body: { email: 'member@example.com', code: '123456', password: 'password-123' } },
      res,
      next
    );

    expect(res.statusCode).toBe(400);
    expect(mockUserFindOne).not.toHaveBeenCalled();
    expect(mockPasswordResetFindOneAndDelete).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a code that has already been consumed', async () => {
    const email = 'member@example.com';
    const code = '654321';
    const user = { save: jest.fn() };
    mockPasswordResetFindOne.mockResolvedValue({
      _id: 'reset-id',
      codeHash: createHmac('sha256', process.env.JWT_SECRET)
        .update(`${email}:${code}`)
        .digest('hex'),
      attempts: 0,
    });
    mockUserFindOne.mockResolvedValue(user);
    mockPasswordResetFindOneAndDelete.mockResolvedValue(null);
    const res = makeResponse();
    const next = jest.fn();

    await resetPassword(
      { body: { email, code, password: 'new-password-123' } },
      res,
      next
    );

    expect(res.statusCode).toBe(400);
    expect(user.save).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('consumes a valid code and saves the new password', async () => {
    const email = 'member@example.com';
    const code = '654321';
    const reset = {
      _id: 'reset-id',
      codeHash: createHmac('sha256', process.env.JWT_SECRET)
        .update(`${email}:${code}`)
        .digest('hex'),
      attempts: 0,
    };
    const user = {
      passwordHash: null,
      googleId: 'google-subject',
      provider: 'google',
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockPasswordResetFindOne.mockResolvedValue(reset);
    mockUserFindOne.mockResolvedValue(user);
    mockPasswordResetFindOneAndDelete.mockResolvedValue(reset);
    const res = makeResponse();
    const next = jest.fn();

    await resetPassword(
      { body: { email, code, password: 'new-password-123' } },
      res,
      next
    );

    expect(mockPasswordResetFindOneAndDelete).toHaveBeenCalledWith(
      expect.objectContaining({ _id: reset._id, codeHash: reset.codeHash })
    );
    expect(user.passwordHash).toBe('new-password-123');
    expect(user.provider).toBe('both');
    expect(user.save).toHaveBeenCalled();
    expect(res.body).toMatchObject({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a configuration error when SMTP is unavailable', async () => {
    mockIsSmtpConfigured.mockReturnValue(false);
    const res = makeResponse();
    const next = jest.fn();

    await requestPasswordReset({ body: { email: 'member@example.com' } }, res, next);

    expect(res.statusCode).toBe(503);
    expect(mockUserFindOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
