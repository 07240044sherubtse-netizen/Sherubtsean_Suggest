const { body, query, validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  req.flash('error', errors.array().map((item) => item.msg));
  return res.redirect(req.get('Referrer') || req.originalUrl || '/');
}

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Please enter your full name (2–120 characters).'),
  body('email').trim().isEmail().isLength({ max: 255 }).withMessage('Please enter a valid email address.').normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be 8–72 characters.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must include a letter.')
    .matches(/\d/)
    .withMessage('Password must include a number.'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match.');
    }
    return true;
  }),
  body('role').isIn(['student', 'tutor']).withMessage('Choose Student or Tutor.')
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Please enter your password.')
];

const suggestionRules = [
  body('title').trim().isLength({ min: 8, max: 160 }).withMessage('Title must be 8–160 characters.'),
  body('description').trim().isLength({ min: 20, max: 4000 }).withMessage('Description must be 20–4000 characters.'),
  body('category_id').isInt({ min: 1 }).withMessage('Please choose a category.')
];

const commentRules = [
  body('content').trim().isLength({ min: 2, max: 1000 }).withMessage('Comments must be 2–1000 characters.')
];

const categoryRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Category name must be 2–80 characters.'),
  body('description').trim().isLength({ min: 0, max: 400 }).withMessage('Description must be 400 characters or fewer.')
];

const searchQueryRules = [
  query('q').optional({ checkFalsy: true }).isLength({ max: 120 }).withMessage('Search is too long.')
];

const statusRules = [
  body('status').isIn(['Open', 'In Progress', 'Resolved']).withMessage('Choose a valid status.')
];

const staffRoleRules = [
  body('role').isIn(['student', 'tutor', 'admin']).withMessage('Choose Student, Tutor, or Admin.')
];

const createAdminRules = [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Please enter a full name (2–120 characters).'),
  body('email').trim().isEmail().isLength({ max: 255 }).withMessage('Please enter a valid email address.').normalizeEmail(),
  body('password')
    .isLength({ min: 8, max: 72 })
    .withMessage('Password must be 8–72 characters.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must include a letter.')
    .matches(/\d/)
    .withMessage('Password must include a number.'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match.');
    }
    return true;
  })
];

module.exports = {
  handleValidation,
  registerRules,
  loginRules,
  suggestionRules,
  commentRules,
  categoryRules,
  searchQueryRules,
  statusRules,
  staffRoleRules,
  createAdminRules
};
