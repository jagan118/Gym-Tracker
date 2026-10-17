const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args) => mockVerifyIdToken(...args),
  })),
}));

const { OAuth2Client } = require('google-auth-library');

const loadVerifier = () => {
  delete require.cache[require.resolve('../utils/googleVerify')];
  return require('../utils/googleVerify');
};

describe('Google ID token verification', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  });

  afterAll(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
  });

  it('verifies the token against the configured web client ID', async () => {
    const payload = {
      sub: 'google-user-1',
      email: 'athlete@example.com',
      email_verified: true,
      name: 'Athlete',
    };
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });

    await expect(loadVerifier()('signed-google-id-token')).resolves.toEqual(payload);
    expect(OAuth2Client).toHaveBeenCalledWith('test-client-id');
    expect(mockVerifyIdToken).toHaveBeenCalledWith({
      idToken: 'signed-google-id-token',
      audience: 'test-client-id',
    });
  });

  it('rejects unverified email addresses', async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-1',
        email: 'athlete@example.com',
        email_verified: false,
      }),
    });

    await expect(loadVerifier()('signed-google-id-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Google account must have a verified email address.',
    });
  });

  it('returns a clear configuration error when no client ID is set', async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    await expect(loadVerifier()('signed-google-id-token')).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining('GOOGLE_CLIENT_ID'),
    });
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects invalid or expired tokens', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(loadVerifier()('bad-token')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Google sign-in token is invalid or expired. Please try again.',
    });
  });
});
