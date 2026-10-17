const express = require('express');
const { body, param } = require('express-validator');
const {
  createWorkout,
  getWorkouts,
  getExerciseNames,
  getGroups,
  getGroupExercises,
  getExerciseHistory,
  getWorkout,
  updateWorkout,
  deleteWorkout,
} = require('../controllers/workoutController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// All workout routes require authentication
router.use(protect);

// GET /api/workouts/exercises — distinct exercise names (for autocomplete)
router.get('/exercises', getExerciseNames);

// GET /api/workouts/groups — muscle group summary cards
router.get('/groups', getGroups);

// GET /api/workouts/groups/:group — exercises inside a muscle group
router.get('/groups/:group', getGroupExercises);

// GET /api/workouts/history/:exerciseName — all records for one exercise
router.get('/history/:exerciseName', getExerciseHistory);

// GET /api/workouts — list workouts with optional filters
router.get('/', getWorkouts);

// POST /api/workouts — create new workout record
router.post(
  '/',
  [
    body('exerciseName').trim().notEmpty().withMessage('Exercise name is required').isLength({ max: 150 }).withMessage('Exercise name too long'),
    body('muscleGroup').optional().isIn(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other']).withMessage('Invalid muscle group'),
    body('variation').optional().isLength({ max: 100 }).withMessage('Variation too long'),
    body('workoutDate').optional().isISO8601().withMessage('Invalid date format'),
    body('weightKg').isFloat({ min: 0 }).withMessage('Weight must be 0 or greater'),
    body('sets').isInt({ min: 1, max: 100 }).withMessage('Sets must be between 1 and 100'),
    body('repsPerSet').isInt({ min: 1, max: 10000 }).withMessage('Reps must be between 1 and 10,000'),
  ],
  validate,
  createWorkout
);

// GET /api/workouts/:id — single workout
router.get('/:id', [param('id').isMongoId().withMessage('Invalid workout ID')], validate, getWorkout);

// PUT /api/workouts/:id — update workout
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid workout ID'),
    body('exerciseName').optional().trim().notEmpty().withMessage('Exercise name cannot be empty').isLength({ max: 150 }),
    body('muscleGroup').optional().isIn(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other']),
    body('variation').optional().isLength({ max: 100 }),
    body('workoutDate').optional().isISO8601().withMessage('Invalid date format'),
    body('weightKg').optional().isFloat({ min: 0 }).withMessage('Weight must be 0 or greater'),
    body('sets').optional().isInt({ min: 1, max: 100 }).withMessage('Sets must be between 1 and 100'),
    body('repsPerSet').optional().isInt({ min: 1, max: 10000 }),
  ],
  validate,
  updateWorkout
);

// DELETE /api/workouts/:id — delete workout
router.delete('/:id', [param('id').isMongoId().withMessage('Invalid workout ID')], validate, deleteWorkout);

module.exports = router;
