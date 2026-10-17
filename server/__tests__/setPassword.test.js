const mockFindById = jest.fn();

jest.mock('../models/User', () => ({
  findById: (...args) => mockFindById(...args),
}));

const { setPassword } = require('../controllers/authController');

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

describe('Set password for Google-linked accounts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves a password and enables both login methods', async () => {
    const user = {
      _id: 'google-user-id',
      googleId: 'google-subject',
      provider: 'google',
      passwordHash: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockFindById.mockResolvedValue(user);
    const res = makeResponse();
    const next = jest.fn();

    await setPassword(
      { user: { id: user._id }, body: { password: 'new-password-123' } },
      res,
      next
    );

    expect(user.passwordHash).toBe('new-password-123');
    expect(user.provider).toBe('both');
    expect(user.save).toHaveBeenCalled();
    expect(res.body).toMatchObject({ success: true });
    expect(res.body.message).toMatch(/sign in with your email and password/i);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects accounts that are not linked to Google', async () => {
    const user = { _id: 'local-user-id', googleId: null, save: jest.fn() };
    mockFindById.mockResolvedValue(user);
    const res = makeResponse();
    const next = jest.fn();

    await setPassword(
      { user: { id: user._id }, body: { password: 'new-password-123' } },
      res,
      next
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(user.save).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the authenticated user no longer exists', async () => {
    mockFindById.mockResolvedValue(null);
    const res = makeResponse();
    const next = jest.fn();

    await setPassword(
      { user: { id: 'deleted-user-id' }, body: { password: 'new-password-123' } },
      res,
      next
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });
});
