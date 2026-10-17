const mockCreateWorkout = jest.fn((req, res) => res.status(201).json({ success: true }));

jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { id: '507f1f77bcf86cd799439011' };
    next();
  },
}));

jest.mock('../controllers/workoutController', () => ({
  createWorkout: (...args) => mockCreateWorkout(...args),
  getWorkouts: jest.fn(),
  getExerciseNames: jest.fn(),
  getGroups: jest.fn(),
  getConsistency: (req, res) => res.json({ success: true, workoutDates: [], invalidGroupCount: 0 }),
  deleteInvalidGroupWorkouts: (req, res) => res.json({ success: true, deletedCount: 0 }),
  getGroupExercises: jest.fn(),
  getExerciseHistory: jest.fn(),
  getWorkout: jest.fn(),
  updateWorkout: jest.fn(),
  deleteWorkout: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const workoutRoutes = require('../routes/workoutRoutes');

const app = express();
app.use(express.json());
app.use('/api/workouts', workoutRoutes);

describe('Workout creation validation', () => {
  beforeEach(() => mockCreateWorkout.mockClear());

  it('requires a muscle group when creating a workout', async () => {
    const response = await request(app)
      .post('/api/workouts')
      .send({ exerciseName: 'Bench Press', weightKg: 20, sets: 3, repsPerSet: 10 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Muscle group is required');
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });

  it('accepts a valid explicitly selected muscle group', async () => {
    const response = await request(app)
      .post('/api/workouts')
      .send({
        exerciseName: 'Bench Press',
        muscleGroup: 'Chest',
        weightKg: 20,
        sets: 3,
        repsPerSet: 10,
      });

    expect(response.status).toBe(201);
    expect(mockCreateWorkout).toHaveBeenCalledTimes(1);
  });
});
