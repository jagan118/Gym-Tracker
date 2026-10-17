jest.mock('../config/db', () => jest.fn());

process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGINS = 'https://app.example.com, https://preview.example.com/';

const request = require('supertest');
const app = require('../server');

describe('API health routes', () => {
  it('returns a helpful status from the backend origin', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      message: expect.stringContaining('under /api'),
    });
  });

  it('keeps the health check endpoint available', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  it('allows configured frontend origins after normalizing trailing slashes', async () => {
    const response = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://preview.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://preview.example.com');
  });
});
