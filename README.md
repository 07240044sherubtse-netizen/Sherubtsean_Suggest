# Sherubtsean Suggest

Campus suggestion and feedback platform for Sherubtse College, Bhutan.

**Your Voice. Our Campus.**

Students and tutors can share suggestions, upvote ideas, comment, and follow progress. Campus admins update suggestion status. Super admins manage administrators, roles, and categories.

## What you need

- Node.js 18 or newer
- PostgreSQL 14 or newer
- A code editor such as Cursor

## 1. Install Node packages

In a terminal, go to this folder and run:

```bash
npm install
```

## 2. Create your environment file

Copy the example file and fill in your PostgreSQL password and a long random session secret:

```bash
copy .env.example .env
```

On macOS or Linux use `cp .env.example .env`.

Edit `.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sherubtsean_suggest_db
DB_USER=postgres
DB_PASSWORD=your-postgres-password
SESSION_SECRET=a-long-random-secret
NODE_ENV=development
ADMIN_NAME=Campus Administrator
ADMIN_EMAIL=admin@sherubtse.edu.bt
ADMIN_PASSWORD=choose-a-strong-password
SUPER_ADMIN_NAME=Campus Super Administrator
SUPER_ADMIN_EMAIL=superadmin@sherubtse.edu.bt
SUPER_ADMIN_PASSWORD=choose-a-strong-password
```

You can use `DATABASE_URL` instead of the individual `DB_*` values if you prefer.

## 3. Create the database and tables

This command creates `sherubtsean_suggest_db` (if needed) and applies `database/schema.sql`:

```bash
npm run db:setup
```

If that fails because PostgreSQL is not on your PATH, you can create the database in pgAdmin, then run the schema file there.

On Windows, `psql` is often here:

`C:\Program Files\PostgreSQL\18\bin\psql.exe`

## 4. Add sample data (optional, recommended while learning)

```bash
npm run db:seed
```

Sample development logins (not for production):

- Student: `pema.student@example.com` / `SamplePass123!`
- Tutor: `karma.tutor@example.com` / `SamplePass123!`

## 5. Create Super Admin and Admin accounts

Public registration cannot create admins. Create the platform owner first:

```bash
npm run db:setup
npm run db:super-admin
```

That reads `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `.env`.

To create a regular campus administrator (optional):

```bash
npm run db:admin
```

That reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`. You can also create admins later from the Super Admin page after you log in.

| Role | Page | What they can do |
| --- | --- | --- |
| Super Admin | `/super-admin` | Create admins, change roles, manage categories, suggestions, and accounts |
| Admin | `/admin` | Update suggestion status, remove suggestions, disable student/tutor accounts |

## 6. Start the website

Development (auto-restart):

```bash
npm run dev
```

Normal start:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Project layout

- `app.js` — starts Express
- `config/db.js` — PostgreSQL connection
- `models/` — database queries
- `controllers/` — request handling
- `routes/` — URL mapping
- `views/` — EJS pages
- `public/` — CSS and JavaScript
- `database/` — schema, seed, and admin setup

## Main pages

- `/` home
- `/auth` login and registration
- `/suggestions` browse, search, filter, sort, paginate
- `/suggestions/new` create a suggestion
- `/suggestions/:id` details, comments, upvotes
- `/dashboard` student/tutor dashboard
- `/admin` campus administrator dashboard
- `/super-admin` super administrator dashboard
- `/privacy` and `/terms`

## Security notes

- Passwords are hashed with bcrypt
- Sessions are stored in PostgreSQL
- Forms use CSRF tokens
- SQL uses parameterized queries
- Never commit `.env`
- Do not reuse the sample seed passwords in production
