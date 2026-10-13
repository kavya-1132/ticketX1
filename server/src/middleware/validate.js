const { validationResult } = require('express-validator');

/**
 * Middleware wrapper to validate express-validator rules
 * Formats validation failure into consistent { error: message } JSON response
 */
function validate(validations) {
  return async (req, res, next) => {
    // Run all validations
    for (const validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const firstError = errors.array()[0];
    return res.status(400).json({ error: firstError.msg });
  };
}

module.exports = validate;
