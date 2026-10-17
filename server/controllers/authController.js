const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { signToken } = require('../middleware/auth');
const verifyGoogleToken = require('../utils/googleVerify');
const { createHmac, randomInt, timingSafeEqual } = require('crypto');
const { isSmtpConfigured, sendPasswordResetEmail } = require('../utils/sendPasswordResetEmail');

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_CODE_RESEND_MS = 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_CODE_MESSAGE = 'If an account exists for that email, a password reset code has been sent.';

const hashResetCode = (email, code) =>
  createHmac('sha256', process.env.JWT_SECRET).update(`${email}:${code}`).digest('hex');

const hasMatchingCode = (storedHash, candidateHash) => {
  const stored = Buffer.from(storedHash, 'hex');
  const candidate = Buffer.from(candidateHash, 'hex');
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
};

// ─── Register ────────────────────────────────────────────────────────────────

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if email already exists
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Create user — passwordHash pre-save hook will hash it
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password,
      provider: 'local',
    });

    const token = signToken(user);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        hasPassword: Boolean(user.passwordHash),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Login ───────────────────────────────────────────────────────────────────

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user (include passwordHash which is excluded by toJSON)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isValid = await user.verifyPassword(password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = signToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        hasPassword: Boolean(user.passwordHash),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Google Auth ─────────────────────────────────────────────────────────────

const googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google ID token is required.' });
    }

    // Verify the token on the backend — never trust client-supplied user info
    const payload = await verifyGoogleToken(idToken);
    const { sub: googleId, email, name } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    // Try to find an existing account by googleId or email
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if email exists (local account) — link Google to it
      user = await User.findOne({ email: normalizedEmail });

      if (user) {
        if (user.googleId && user.googleId !== googleId) {
          return res.status(409).json({
            success: false,
            message: 'This email is already linked to a different Google account.',
          });
        }
        // Link Google to existing local account
        user.googleId = googleId;
        user.provider = 'both';
        await user.save();
      } else {
        // Create a new Google-only account
        user = await User.create({
          name: name || normalizedEmail.split('@')[0],
          email: normalizedEmail,
          googleId,
          provider: 'google',
        });
      }
    }

    const token = signToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        hasPassword: Boolean(user.passwordHash),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Request password-reset code ────────────────────────────────────────────

const requestPasswordReset = async (req, res, next) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Password reset email is unavailable. Ask the administrator to configure SMTP.',
      });
    }

    const email = req.body.email.toLowerCase().trim();
    const response = { success: true, message: RESET_CODE_MESSAGE };
    const user = await User.findOne({ email });

    if (!user) return res.json(response);

    const previousReset = await PasswordReset.findOne({ email });
    const now = Date.now();
    if (previousReset && now - previousReset.lastSentAt.getTime() < RESET_CODE_RESEND_MS) {
      return res.json(response);
    }

    const code = String(randomInt(100000, 1000000));
    await sendPasswordResetEmail(email, code);

    await PasswordReset.findOneAndUpdate(
      { email },
      {
        $set: {
          codeHash: hashResetCode(email, code),
          attempts: 0,
          lastSentAt: new Date(now),
          expiresAt: new Date(now + RESET_CODE_TTL_MS),
        },
        $setOnInsert: { email },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.json(response);
  } catch (error) {
    next(error);
  }
};

// ─── Reset password with email code ─────────────────────────────────────────

const resetPassword = async (req, res, next) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const reset = await PasswordReset.findOne({ email, expiresAt: { $gt: new Date() } });

    if (!reset || reset.attempts >= RESET_CODE_MAX_ATTEMPTS) {
      return res.status(400).json({ success: false, message: 'The reset code is invalid or expired. Request a new code and try again.' });
    }

    const candidateHash = hashResetCode(email, req.body.code);
    if (!hasMatchingCode(reset.codeHash, candidateHash)) {
      await PasswordReset.updateOne(
        { _id: reset._id, attempts: { $lt: RESET_CODE_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } }
      );
      return res.status(400).json({ success: false, message: 'The reset code is invalid or expired. Request a new code and try again.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await PasswordReset.deleteOne({ _id: reset._id });
      return res.status(400).json({ success: false, message: 'The reset code is invalid or expired. Request a new code and try again.' });
    }

    const consumed = await PasswordReset.findOneAndDelete({
      _id: reset._id,
      codeHash: candidateHash,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
    });
    if (!consumed) {
      return res.status(400).json({ success: false, message: 'The reset code is invalid or expired. Request a new code and try again.' });
    }

    user.passwordHash = req.body.password;
    if (user.googleId) user.provider = 'both';
    await user.save();

    return res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    next(error);
  }
};

// ─── Set password for Google-authenticated account ───────────────────────────

const setPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!user.googleId) {
      return res.status(403).json({
        success: false,
        message: 'A Google-linked account is required to set a password this way.',
      });
    }

    user.passwordHash = req.body.password;
    user.provider = 'both';
    await user.save();

    res.json({ success: true, message: 'Password saved. You can now sign in with your email and password.' });
  } catch (error) {
    next(error);
  }
};

// ─── Logout ──────────────────────────────────────────────────────────────────

const logout = (req, res) => {
  // With localStorage JWT the client just removes the token,
  // but we still provide a clean logout endpoint for future-proofing
  res.json({ success: true, message: 'Logged out successfully.' });
};

// ─── Get Current User ────────────────────────────────────────────────────────

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        provider: user.provider,
        hasPassword: Boolean(user.passwordHash),
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleAuth,
  requestPasswordReset,
  resetPassword,
  setPassword,
  logout,
  getMe,
};
