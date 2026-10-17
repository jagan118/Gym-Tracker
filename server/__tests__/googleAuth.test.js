const mockUserFindOne = jest.fn();
const mockUserCreate = jest.fn();
const mockVerifyGoogleToken = jest.fn();

jest.mock('../models/User', () => ({
  findOne: (...args) => mockUserFindOne(...args),
  create: (...args) => mockUserCreate(...args),
}));

jest.mock('../middleware/auth', () => ({
  signToken: (user) => `jwt-for-${user._id}`,
}));

jest.mock('../utils/googleVerify', () => (...args) => mockVerifyGoogleToken(...args));

const { googleAuth } = require('../controllers/authController');

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

describe('Google account persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyGoogleToken.mockResolvedValue({
      sub: 'stable-google-subject',
      email: 'Athlete@Example.com',
      email_verified: true,
      name: 'Athlete',
    });
  });

  it('signs the returning Google account into the same database user', async () => {
    const savedUser = {
      _id: 'existing-user-id',
      name: 'Athlete',
      email: 'athlete@example.com',
      googleId: 'stable-google-subject',
    };
    mockUserFindOne.mockResolvedValueOnce(savedUser);
    const res = makeResponse();
    const next = jest.fn();

    await googleAuth({ body: { idToken: 'signed-google-id-token' } }, res, next);

    expect(mockUserFindOne).toHaveBeenCalledWith({ googleId: 'stable-google-subject' });
    expect(res.body).toMatchObject({
      success: true,
      token: 'jwt-for-existing-user-id',
      user: { id: 'existing-user-id', email: 'athlete@example.com' },
    });
    expect(mockUserCreate).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('creates a database account for a first-time Google user', async () => {
    mockUserFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockUserCreate.mockResolvedValue({
      _id: 'new-user-id',
      name: 'Athlete',
      email: 'athlete@example.com',
    });
    const res = makeResponse();
    const next = jest.fn();

    await googleAuth({ body: { idToken: 'signed-google-id-token' } }, res, next);

    expect(mockUserCreate).toHaveBeenCalledWith({
      name: 'Athlete',
      email: 'athlete@example.com',
      googleId: 'stable-google-subject',
      provider: 'google',
    });
    expect(res.body.token).toBe('jwt-for-new-user-id');
    expect(next).not.toHaveBeenCalled();
  });

  it('links a verified Google account to an existing account with the same email', async () => {
    const existingUser = {
      _id: 'local-user-id',
      name: 'Athlete',
      email: 'athlete@example.com',
      googleId: null,
      provider: 'local',
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockUserFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser);
    const res = makeResponse();
    const next = jest.fn();

    await googleAuth({ body: { idToken: 'signed-google-id-token' } }, res, next);

    expect(existingUser.googleId).toBe('stable-google-subject');
    expect(existingUser.provider).toBe('both');
    expect(existingUser.save).toHaveBeenCalled();
    expect(res.body.token).toBe('jwt-for-local-user-id');
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});
