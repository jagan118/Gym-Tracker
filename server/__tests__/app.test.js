/**
 * Backend integration tests
 * Run: cd server && npm test
 *
 * Uses an in-memory test environment — you need to set TEST_MONGODB_URI
 * or it will try to use MONGODB_URI from .env. For CI, use mongodb-memory-server.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Workout = require('../models/Workout');

// Load env
require('dotenv').config();

let token1, token2, userId1, userId2;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  // Clean test data
  await User.deleteMany({ email: /test_gymlog/ });
  await Workout.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({ email: /test_gymlog/ });
  await Workout.deleteMany({ userId: { $in: [userId1, userId2].filter(Boolean) } });
  await mongoose.connection.close();
});

// ─── Auth Tests ────────────────────────────────────────────────

describe('Auth: Register', () => {
  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User 1', email: 'test_gymlog_1@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test_gymlog_1@example.com');
    token1 = res.body.token;
    userId1 = res.body.user.id;
  });

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User 1', email: 'test_gymlog_1@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'test_gymlog_x@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('Auth: Login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test_gymlog_1@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test_gymlog_1@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});

// ─── Workout CRUD Tests ────────────────────────────────────────

describe('Workouts: Create', () => {
  it('creates a workout record', async () => {
    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        exerciseName: 'Incline Dumbbell Press',
        muscleGroup: 'Chest',
        variation: 'Incline',
        workoutDate: '2026-10-14',
        weightKg: 12.5,
        sets: 3,
        repsPerSet: 12,
      });
    expect(res.status).toBe(201);
    expect(res.body.workout.exerciseName).toBe('Incline Dumbbell Press');
    expect(res.body.workout.weightKg).toBe(12.5);
  });

  it('rejects missing exercise name', async () => {
    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token1}`)
      .send({ weightKg: 10, sets: 3, repsPerSet: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects negative weight', async () => {
    const res = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token1}`)
      .send({ exerciseName: 'Test', muscleGroup: 'Chest', weightKg: -5, sets: 3, repsPerSet: 10 });
    expect(res.status).toBe(400);
  });
});

describe('Workouts: History Preservation — CRITICAL', () => {
  let record1Id, record2Id, record3Id;

  beforeAll(async () => {
    // Create three separate dated records for the same exercise
    const r1 = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token1}`)
      .send({ exerciseName: 'Barbell Squat', muscleGroup: 'Leg', workoutDate: '2026-10-14', weightKg: 80, sets: 4, repsPerSet: 6 });
    record1Id = r1.body.workout._id;

    const r2 = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token1}`)
      .send({ exerciseName: 'Barbell Squat', muscleGroup: 'Leg', workoutDate: '2026-10-15', weightKg: 85, sets: 4, repsPerSet: 6 });
    record2Id = r2.body.workout._id;

    const r3 = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${token1}`)
      .send({ exerciseName: 'Barbell Squat', muscleGroup: 'Leg', workoutDate: '2026-10-16', weightKg: 90, sets: 4, repsPerSet: 5 });
    record3Id = r3.body.workout._id;
  });

  it('keeps all three separate records — no overwrite', async () => {
    const res = await request(app)
      .get('/api/workouts/history/Barbell Squat')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.workouts.length).toBeGreaterThanOrEqual(3);

    const weights = res.body.workouts.map(w => w.weightKg);
    expect(weights).toContain(80);
    expect(weights).toContain(85);
    expect(weights).toContain(90);
  });

  it('editing one record does not affect others', async () => {
    // Edit the Oct 15 record
    await request(app)
      .put(`/api/workouts/${record2Id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ weightKg: 87.5 });

    // Oct 14 record should still have 80 kg
    const r1 = await request(app)
      .get(`/api/workouts/${record1Id}`)
      .set('Authorization', `Bearer ${token1}`);
    expect(r1.body.workout.weightKg).toBe(80);

    // Oct 16 record should still have 90 kg
    const r3 = await request(app)
      .get(`/api/workouts/${record3Id}`)
      .set('Authorization', `Bearer ${token1}`);
    expect(r3.body.workout.weightKg).toBe(90);

    // Oct 15 record should now be 87.5 kg
    const r2 = await request(app)
      .get(`/api/workouts/${record2Id}`)
      .set('Authorization', `Bearer ${token1}`);
    expect(r2.body.workout.weightKg).toBe(87.5);
  });

  it('deleting one record does not affect others', async () => {
    await request(app)
      .delete(`/api/workouts/${record2Id}`)
      .set('Authorization', `Bearer ${token1}`);

    const res = await request(app)
      .get('/api/workouts/history/Barbell Squat')
      .set('Authorization', `Bearer ${token1}`);

    const ids = res.body.workouts.map(w => w._id);
    expect(ids).not.toContain(record2Id);
    expect(ids).toContain(record1Id);
    expect(ids).toContain(record3Id);
  });
});

describe('Security: User Isolation', () => {
  let otherToken, otherUserId, otherWorkoutId;

  beforeAll(async () => {
    // Register a second user
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User 2', email: 'test_gymlog_2@example.com', password: 'password456' });
    otherToken = res.body.token;
    otherUserId = res.body.user.id;
    token2 = otherToken;
    userId2 = otherUserId;

    // Create a workout for user 2
    const w = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ exerciseName: 'Bench Press', muscleGroup: 'Chest', workoutDate: '2026-10-16', weightKg: 100, sets: 5, repsPerSet: 5 });
    otherWorkoutId = w.body.workout._id;
  });

  it('user 1 cannot read user 2 workout', async () => {
    const res = await request(app)
      .get(`/api/workouts/${otherWorkoutId}`)
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(404);
  });

  it('user 1 cannot edit user 2 workout', async () => {
    const res = await request(app)
      .put(`/api/workouts/${otherWorkoutId}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ weightKg: 999 });
    expect(res.status).toBe(404);
  });

  it('user 1 cannot delete user 2 workout', async () => {
    const res = await request(app)
      .delete(`/api/workouts/${otherWorkoutId}`)
      .set('Authorization', `Bearer ${token1}`);
    expect(res.status).toBe(404);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/workouts');
    expect(res.status).toBe(401);
  });
});
