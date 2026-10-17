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
const Workout = require('../models/Workout');

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

  describe('Workout cardio model validation', () => {
    const cardioRecord = (stepsCount) => new Workout({
      userId: '507f1f77bcf86cd799439011',
      exerciseName: 'Walking',
      muscleGroup: 'Cardio',
      workoutDate: new Date('2026-10-18T00:00:00.000Z'),
      ...(stepsCount === undefined ? {} : { stepsCount }),
    });

    it('allows cardio records with steps and without strength-training values', () => {
      expect(cardioRecord(6500).validateSync()).toBeUndefined();
    });

    it('requires steps for cardio records', () => {
      expect(cardioRecord().validateSync().errors.stepsCount).toBeDefined();
    });
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

  it('accepts cardio with a step count instead of weight, sets, and reps', async () => {
    const response = await request(app)
      .post('/api/workouts')
      .send({
        exerciseName: 'Walking',
        muscleGroup: 'Cardio',
        stepsCount: 6500,
        cardioExerciseName: 'Pushups',
        cardioExerciseInfo: '50 reps',
      });

    expect(response.status).toBe(201);
    expect(mockCreateWorkout).toHaveBeenCalledTimes(1);
  });

  it('rejects additional cardio exercise names that exceed the limit', async () => {
    const response = await request(app)
      .post('/api/workouts')
      .send({
        exerciseName: 'Walking',
        muscleGroup: 'Cardio',
        stepsCount: 6500,
        cardioExerciseName: 'x'.repeat(101),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Additional exercise name');
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });

  it('rejects additional cardio details that exceed the limit', async () => {
    const response = await request(app)
      .post('/api/workouts')
      .send({
        exerciseName: 'Walking',
        muscleGroup: 'Cardio',
        stepsCount: 6500,
        cardioExerciseInfo: 'x'.repeat(201),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Additional exercise information');
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });

  it('requires a positive integer step count for cardio', async () => {
    const response = await request(app)
      .post('/api/workouts')
      .send({ exerciseName: 'Walking', muscleGroup: 'Cardio' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Step count');
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });

  it('rejects muscle groups outside the supported choices', async () => {
    const response = await request(app)
      .post('/api/workouts')
      .send({
        exerciseName: 'Shoulder Press',
        muscleGroup: 'Shoulders',
        weightKg: 20,
        sets: 3,
        repsPerSet: 10,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid muscle group');
    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });
});
