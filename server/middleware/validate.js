const { validationResult } = require('express-validator');

/**
 * Middleware: run after express-validator chains.
 * If there are validation errors, respond with 400 and the first error message.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  next();
};

module.exports = validate;
