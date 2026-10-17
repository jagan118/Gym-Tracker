const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name must be 100 characters or fewer'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    // Null for Google-only accounts
    passwordHash: {
      type: String,
      default: null,
    },
    // Null for local accounts
    googleId: {
      type: String,
      default: null,
    },
    // 'local' | 'google' | 'both'
    provider: {
      type: String,
      enum: ['local', 'google', 'both'],
      default: 'local',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);

// Hash password before saving if it was modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Instance method to verify a plain-text password
userSchema.methods.verifyPassword = async function (plainPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Never return password hash or Google ID in JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.googleId;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
