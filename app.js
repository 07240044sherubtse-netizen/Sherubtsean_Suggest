require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const flash = require('connect-flash');
const pgSession = require('connect-pg-simple')(session);

const { pool } = require('./config/db');
const { ensureCsrfToken, verifyCsrf } = require('./middleware/csrf');
const { isStaff, isSuperAdmin } = require('./middleware/auth');
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/authRoutes');
const suggestionRoutes = require('./routes/suggestionRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const commentRoutes = require('./routes/commentRoutes');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set. Add it to your .env file before using this app in production.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', isProduction ? 1 : 0);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"]
      }
    }
  })
);

app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'dev-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(flash());
app.use(ensureCsrfToken);
app.use(verifyCsrf);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.isStaffUser = isStaff(req.session.user);
  res.locals.isSuperAdminUser = isSuperAdmin(req.session.user);
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  res.locals.formatDate = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value));
  };
  next();
});

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/suggestions', suggestionRoutes);
app.use('/comments', commentRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin', adminRoutes);
app.use('/super-admin', superAdminRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    status: 404,
    message: 'The page you were looking for does not exist.'
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).render('error', {
    title: 'Something went wrong',
    status,
    message: isProduction
      ? 'An unexpected error occurred. Please try again.'
      : 'Something went wrong while processing your request.'
  });
});

app.listen(PORT, () => {
  console.log(`Sherubtsean Suggest is running at http://localhost:${PORT}`);
});
