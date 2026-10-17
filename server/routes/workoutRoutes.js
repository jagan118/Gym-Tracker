const express = require('express');
const { body, param } = require('express-validator');
const {
  createWorkout,
  getWorkouts,
  getExerciseNames,
  getGroups,
  getConsistency,
  deleteInvalidGroupWorkouts,
  getGroupExercises,
  getExerciseHistory,
  getWorkout,
  updateWorkout,
  deleteWorkout,
} = require('../controllers/workoutController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
const MUSCLE_GROUPS = ['Chest', 'Tricep', 'Back', 'Bicep', 'Leg', 'Shoulder', 'Core', 'Cardio'];

// All workout routes require authentication
router.use(protect);

// GET /api/workouts/exercises — distinct exercise names (for autocomplete)
router.get('/exercises', getExerciseNames);

// GET /api/workouts/groups — muscle group summary cards
router.get('/groups', getGroups);

// GET /api/workouts/consistency — workout dates and legacy invalid-group count
router.get('/consistency', getConsistency);

// DELETE /api/workouts/legacy-groups — remove this user's invalid-group records
router.delete('/legacy-groups', deleteInvalidGroupWorkouts);

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
    body('muscleGroup').notEmpty().withMessage('Muscle group is required').bail().isIn(MUSCLE_GROUPS).withMessage('Invalid muscle group'),
    body('variation').optional().isLength({ max: 100 }).withMessage('Variation too long'),
    body('workoutDate').optional().isISO8601().withMessage('Invalid date format'),
    body('weightKg').if((value, { req }) => req.body.muscleGroup !== 'Cardio').isFloat({ min: 0 }).withMessage('Weight must be 0 or greater'),
    body('sets').if((value, { req }) => req.body.muscleGroup !== 'Cardio').isInt({ min: 1, max: 100 }).withMessage('Sets must be between 1 and 100'),
    body('repsPerSet').if((value, { req }) => req.body.muscleGroup !== 'Cardio').isInt({ min: 1, max: 10000 }).withMessage('Reps must be between 1 and 10,000'),
    body('stepsCount').if((value, { req }) => req.body.muscleGroup === 'Cardio').isInt({ min: 1, max: 1000000 }).withMessage('Step count must be between 1 and 1,000,000'),
    body('cardioExerciseName').optional().isString().isLength({ max: 100 }).withMessage('Additional exercise name must be 100 characters or fewer'),
    body('cardioExerciseInfo').optional().isString().isLength({ max: 200 }).withMessage('Additional exercise information must be 200 characters or fewer'),
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
    body('muscleGroup').optional().isIn(MUSCLE_GROUPS),
    body('variation').optional().isLength({ max: 100 }),
    body('workoutDate').optional().isISO8601().withMessage('Invalid date format'),
    body('weightKg').optional().isFloat({ min: 0 }).withMessage('Weight must be 0 or greater'),
    body('sets').optional().isInt({ min: 1, max: 100 }).withMessage('Sets must be between 1 and 100'),
    body('repsPerSet').optional().isInt({ min: 1, max: 10000 }),
    body('stepsCount').optional().isInt({ min: 1, max: 1000000 }).withMessage('Step count must be between 1 and 1,000,000'),
    body('cardioExerciseName').optional().isString().isLength({ max: 100 }).withMessage('Additional exercise name must be 100 characters or fewer'),
    body('cardioExerciseInfo').optional().isString().isLength({ max: 200 }).withMessage('Additional exercise information must be 200 characters or fewer'),
  ],
  validate,
  updateWorkout
);

// DELETE /api/workouts/:id — delete workout
router.delete('/:id', [param('id').isMongoId().withMessage('Invalid workout ID')], validate, deleteWorkout);

module.exports = router;
