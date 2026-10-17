const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema(
  {
    // Reference to the owning user — NEVER taken from client requests
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    exerciseName: {
      type: String,
      required: [true, 'Exercise name is required'],
      trim: true,
      maxlength: [150, 'Exercise name must be 150 characters or fewer'],
    },

    // Lowercase, trimmed version used for case-insensitive search
    exerciseNameNormalized: {
      type: String,
      default: '',
    },

    // Muscle group category for grouping exercises on the home page
    muscleGroup: {
      type: String,
      trim: true,
      default: 'Other',
      enum: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other'],
    },

    // Optional variation — e.g. "Incline", "Wide-Grip", "Sumo"
    variation: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Variation must be 100 characters or fewer'],
    },

    // Actual date the workout was performed (not necessarily today)
    workoutDate: {
      type: Date,
      required: [true, 'Workout date is required'],
    },

    // Weight in kg — 0 is valid for bodyweight exercises
    weightKg: {
      type: Number,
      required: [true, 'Weight is required'],
      min: [0, 'Weight cannot be negative'],
    },

    sets: {
      type: Number,
      required: [true, 'Number of sets is required'],
      min: [1, 'Sets must be at least 1'],
      max: [100, 'Sets must be 100 or fewer'],
    },

    repsPerSet: {
      type: Number,
      required: [true, 'Reps per set is required'],
      min: [1, 'Reps must be at least 1'],
      max: [10000, 'Reps per set must be 10,000 or fewer'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
// 1. Home page: list all workouts for a user, newest first
workoutSchema.index({ userId: 1, workoutDate: -1 });

// 2. Exercise history: all records for one exercise, newest first
workoutSchema.index({ userId: 1, exerciseNameNormalized: 1, workoutDate: -1 });

// Normalize exercise name before saving
workoutSchema.pre('save', function (next) {
  this.exerciseNameNormalized = this.exerciseName.toLowerCase().trim();
  next();
});

// Also normalize on update operations
workoutSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.exerciseName) {
    update.exerciseNameNormalized = update.exerciseName.toLowerCase().trim();
  }
  if (update.$set && update.$set.exerciseName) {
    update.$set.exerciseNameNormalized = update.$set.exerciseName.toLowerCase().trim();
  }
  next();
});

module.exports = mongoose.model('Workout', workoutSchema);
