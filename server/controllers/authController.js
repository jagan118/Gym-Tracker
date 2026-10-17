const User = require('../models/User');
const { signToken } = require('../middleware/auth');
const verifyGoogleToken = require('../utils/googleVerify');

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
      },
    });
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
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, googleAuth, logout, getMe };
