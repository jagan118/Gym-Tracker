const Workout = require('../models/Workout');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Create Workout ───────────────────────────────────────────────────────────

const createWorkout = async (req, res, next) => {
  try {
    const { exerciseName, muscleGroup, variation, workoutDate, weightKg, sets, repsPerSet, stepsCount } = req.body;

    // userId is ALWAYS taken from the verified JWT, never from the request body
    const workout = await Workout.create({
      userId: req.user.id,
      exerciseName,
      exerciseNameNormalized: exerciseName.toLowerCase().trim(),
      muscleGroup: muscleGroup || 'Other',
      variation: variation || '',
      workoutDate: workoutDate ? new Date(workoutDate) : new Date(),
      weightKg,
      sets,
      repsPerSet,
      stepsCount,
    });

    res.status(201).json({ success: true, workout });
  } catch (error) {
    next(error);
  }
};

// ─── Get Workouts (Home Page List) ────────────────────────────────────────────

const getWorkouts = async (req, res, next) => {
  try {
    const { exercise, dateFrom, dateTo, limit = 20, page = 1 } = req.query;

    const filter = { userId: req.user.id };

    // Optional: literal substring search for exercise names
    if (exercise && exercise.trim()) {
      filter.exerciseNameNormalized = {
        $regex: escapeRegex(exercise.trim()),
        $options: 'i',
      };
    }

    // Optional: date range filter
    if (dateFrom || dateTo) {
      filter.workoutDate = {};
      if (dateFrom) filter.workoutDate.$gte = new Date(dateFrom);
      if (dateTo) filter.workoutDate.$lte = new Date(dateTo);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [workouts, total] = await Promise.all([
      Workout.find(filter)
        .sort({ workoutDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Workout.countDocuments(filter),
    ]);

    res.json({
      success: true,
      workouts,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Distinct Exercise Names ──────────────────────────────────────────────

const getExerciseNames = async (req, res, next) => {
  try {
    const { search } = req.query;

    const matchStage = { userId: new (require('mongoose').Types.ObjectId)(req.user.id) };

    if (typeof search === 'string' && search.trim()) {
      const searchRegex = { $regex: escapeRegex(search.trim()), $options: 'i' };
      matchStage.exerciseNameNormalized = {
        ...searchRegex,
      };
      matchStage.$or = [
        { exerciseNameNormalized: searchRegex },
        { variation: searchRegex },
      ];
      delete matchStage.exerciseNameNormalized;
    }

    // Return the latest record for each exercise/variation pair for the user
    const exercises = await Workout.aggregate([
      { $match: matchStage },
      { $sort: { workoutDate: -1, createdAt: -1 } },
      {
        $group: {
          _id: { exerciseName: '$exerciseName', variation: '$variation' },
          lastDate: { $first: '$workoutDate' },
          count: { $sum: 1 },
          muscleGroup: { $first: '$muscleGroup' },
          weightKg: { $first: '$weightKg' },
          sets: { $first: '$sets' },
          repsPerSet: { $first: '$repsPerSet' },
          stepsCount: { $first: '$stepsCount' },
          exerciseNameNormalized: { $first: '$exerciseNameNormalized' },
        },
      },
      { $sort: { lastDate: -1 } },
      {
        $project: {
          _id: 0,
          exerciseName: '$_id.exerciseName',
          variation: '$_id.variation',
          lastDate: 1,
          count: 1,
          muscleGroup: 1,
          weightKg: 1,
          sets: 1,
          repsPerSet: 1,
          stepsCount: 1,
          exerciseNameNormalized: 1,
        },
      },
    ]);

    res.json({ success: true, exercises });
  } catch (error) {
    next(error);
  }
};

// ─── Get Muscle Groups Summary ────────────────────────────────────────────────

const getGroups = async (req, res, next) => {
  try {
    const userId = new (require('mongoose').Types.ObjectId)(req.user.id);

    const groups = await Workout.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$muscleGroup',
          exerciseCount: { $addToSet: '$exerciseNameNormalized' },
          lastDate: { $max: '$workoutDate' },
          totalSessions: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          muscleGroup: '$_id',
          exerciseCount: { $size: '$exerciseCount' },
          lastDate: 1,
          totalSessions: 1,
        },
      },
      { $sort: { lastDate: -1 } },
    ]);

    res.json({ success: true, groups });
  } catch (error) {
    next(error);
  }
};

const getConsistency = async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const invalidGroupFilter = {
      userId,
      $or: [
        { muscleGroup: { $exists: false } },
        { muscleGroup: null },
        { muscleGroup: '' },
        { muscleGroup: { $regex: '^null$', $options: 'i' } },
      ],
    };
    const [workoutDates, invalidGroupCount] = await Promise.all([
      Workout.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$workoutDate', timezone: 'UTC' },
            },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id' } },
      ]),
      Workout.countDocuments(invalidGroupFilter),
    ]);

    res.json({
      success: true,
      workoutDates: workoutDates.map(({ date }) => date),
      invalidGroupCount,
    });
  } catch (error) {
    next(error);
  }
};

const deleteInvalidGroupWorkouts = async (req, res, next) => {
  try {
    const result = await Workout.deleteMany({
      userId: req.user.id,
      $or: [
        { muscleGroup: { $exists: false } },
        { muscleGroup: null },
        { muscleGroup: '' },
        { muscleGroup: { $regex: '^null$', $options: 'i' } },
      ],
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} workout record${result.deletedCount === 1 ? '' : 's'} deleted.`,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Exercises Within a Muscle Group ──────────────────────────────────────

const getGroupExercises = async (req, res, next) => {
  try {
    const { group } = req.params;
    const userId = new (require('mongoose').Types.ObjectId)(req.user.id);

    const exercises = await Workout.aggregate([
      { $match: { userId, muscleGroup: group } },
      { $sort: { workoutDate: -1, createdAt: -1 } },
      {
        $group: {
          _id: { exerciseName: '$exerciseName', variation: '$variation' },
          exerciseNameNormalized: { $first: '$exerciseNameNormalized' },
          muscleGroup: { $first: '$muscleGroup' },
          lastDate: { $first: '$workoutDate' },
          lastWeight: { $first: '$weightKg' },
          lastSets: { $first: '$sets' },
          lastReps: { $first: '$repsPerSet' },
          lastSteps: { $first: '$stepsCount' },
          totalSessions: { $sum: 1 },
        },
      },
      { $sort: { lastDate: -1 } },
      {
        $project: {
          _id: 0,
          exerciseName: '$_id.exerciseName',
          variation: '$_id.variation',
          exerciseNameNormalized: 1,
          muscleGroup: 1,
          lastDate: 1,
          lastWeight: 1,
          lastSets: 1,
          lastReps: 1,
          lastSteps: 1,
          totalSessions: 1,
        },
      },
    ]);

    res.json({ success: true, exercises, muscleGroup: group });
  } catch (error) {
    next(error);
  }
};

// ─── Get Exercise History ─────────────────────────────────────────────────────

const getExerciseHistory = async (req, res, next) => {
  try {
    const { exerciseName } = req.params;
    const { variation } = req.query;

    if (!exerciseName) {
      return res.status(400).json({ success: false, message: 'Exercise name is required.' });
    }

    const filter = {
      userId: req.user.id,
      exerciseNameNormalized: exerciseName.toLowerCase().trim(),
    };

    // Filter by variation if provided (empty string = no variation)
    if (variation !== undefined) {
      filter.variation = variation;
    }

    const workouts = await Workout.find(filter).sort({ workoutDate: -1, createdAt: -1 });

    res.json({ success: true, workouts, exerciseName });
  } catch (error) {
    next(error);
  }
};

// ─── Get Single Workout ───────────────────────────────────────────────────────

const getWorkout = async (req, res, next) => {
  try {
    // Scoped to current user — prevents accessing other users' records
    const workout = await Workout.findOne({ _id: req.params.id, userId: req.user.id });

    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout record not found.' });
    }

    res.json({ success: true, workout });
  } catch (error) {
    next(error);
  }
};

// ─── Update Workout ───────────────────────────────────────────────────────────

const updateWorkout = async (req, res, next) => {
  try {
    const { exerciseName, muscleGroup, variation, workoutDate, weightKg, sets, repsPerSet, stepsCount } = req.body;

    const updateData = {};
    if (exerciseName !== undefined) updateData.exerciseName = exerciseName;
    if (muscleGroup !== undefined) updateData.muscleGroup = muscleGroup;
    if (variation !== undefined) updateData.variation = variation;
    if (workoutDate !== undefined) updateData.workoutDate = new Date(workoutDate);
    if (weightKg !== undefined) updateData.weightKg = weightKg;
    if (sets !== undefined) updateData.sets = sets;
    if (repsPerSet !== undefined) updateData.repsPerSet = repsPerSet;
    if (stepsCount !== undefined) updateData.stepsCount = stepsCount;

    // findOneAndUpdate with userId scope — only updates if user owns it
    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout record not found.' });
    }

    res.json({ success: true, workout });
  } catch (error) {
    next(error);
  }
};

// ─── Delete Workout ───────────────────────────────────────────────────────────

const deleteWorkout = async (req, res, next) => {
  try {
    // Scoped deletion — can only delete own records
    const workout = await Workout.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout record not found.' });
    }

    res.json({ success: true, message: 'Workout record deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
