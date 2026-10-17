jest.mock('../config/db', () => jest.fn());

process.env.NODE_ENV = 'test';

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
});
