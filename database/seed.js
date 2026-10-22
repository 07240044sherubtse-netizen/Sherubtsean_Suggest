require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

function poolConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'sherubtsean_suggest_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  };
}

const categories = [
  ['Academics', 'Courses, teaching, assessments, and academic support.'],
  ['Facilities', 'Classrooms, labs, library, and campus infrastructure.'],
  ['Hostel', 'Housing, rooms, and residential life.'],
  ['Food & Dining', 'Mess, canteen, and dining services.'],
  ['Student Services', 'Counseling, administration, and student support.'],
  ['Campus Life', 'Clubs, events, sports, and community.'],
  ['Other', 'Ideas that do not fit a specific category.']
];

async function seed() {
  const pool = new Pool(poolConfig());
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [name, description] of categories) {
      await client.query(
        `INSERT INTO categories (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [name, description]
      );
    }

    const samplePassword = await bcrypt.hash('SamplePass123!', 12);

    const sampleUsers = [
      ['Pema Dorji', 'pema.student@example.com', 'student'],
      ['Sonam Choden', 'sonam.student@example.com', 'student'],
      ['Karma Wangchuk', 'karma.tutor@example.com', 'tutor']
    ];

    const userIds = [];
    for (const [name, email, role] of sampleUsers) {
      const result = await client.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [name, email, samplePassword, role]
      );
      userIds.push(result.rows[0].id);
    }

    const categoryRows = await client.query('SELECT id, name FROM categories');
    const categoryMap = Object.fromEntries(categoryRows.rows.map((row) => [row.name, row.id]));

    const existingSample = await client.query(
      "SELECT id FROM suggestions WHERE title = $1",
      ['Extend library opening hours during exams']
    );

    if (existingSample.rowCount === 0) {
      const suggestions = [
        {
          userId: userIds[0],
          category: 'Academics',
          title: 'Extend library opening hours during exams',
          description:
            'During midterms and finals the library closes before many students finish group study. Later hours, even for two weeks, would help.',
          anonymous: false,
          status: 'In Progress'
        },
        {
          userId: userIds[1],
          category: 'Food & Dining',
          title: 'Add more vegetarian options in the mess',
          description:
            'Vegetarian students often have only one main dish. A rotating vegetarian menu would make meals more inclusive.',
          anonymous: true,
          status: 'Open'
        },
        {
          userId: userIds[2],
          category: 'Facilities',
          title: 'Improve Wi-Fi coverage in academic blocks',
          description:
            'Connectivity drops in some classrooms during lectures. Stronger access points would support research and teaching.',
          anonymous: false,
          status: 'Open'
        },
        {
          userId: userIds[0],
          category: 'Campus Life',
          title: 'Create a monthly campus ideas forum',
          description:
            'A short open forum would let students and tutors discuss suggestions together and hear updates from administration.',
          anonymous: false,
          status: 'Resolved'
        }
      ];

      const suggestionIds = [];
      for (const item of suggestions) {
        const result = await client.query(
          `INSERT INTO suggestions (user_id, category_id, title, description, is_anonymous, status)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            item.userId,
            categoryMap[item.category],
            item.title,
            item.description,
            item.anonymous,
            item.status
          ]
        );
        suggestionIds.push(result.rows[0].id);
      }

      await client.query(
        `INSERT INTO comments (suggestion_id, user_id, content)
         VALUES
         ($1, $2, $3),
         ($4, $5, $6),
         ($7, $8, $9)`,
        [
          suggestionIds[0],
          userIds[1],
          'This would help a lot during finals week.',
          suggestionIds[0],
          userIds[2],
          'Tutors would also benefit from quieter evening study spaces.',
          suggestionIds[1],
          userIds[0],
          'Agree. Variety would make a real difference.'
        ]
      );

      await client.query(
        `INSERT INTO likes (user_id, suggestion_id)
         VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8)
         ON CONFLICT DO NOTHING`,
        [
          userIds[1],
          suggestionIds[0],
          userIds[2],
          suggestionIds[0],
          userIds[0],
          suggestionIds[1],
          userIds[2],
          suggestionIds[2]
        ]
      );
    }

    await client.query('COMMIT');
    console.log('Seed data inserted.');
    console.log('Sample student login: pema.student@example.com / SamplePass123!');
    console.log('Sample tutor login: karma.tutor@example.com / SamplePass123!');
    console.log('These sample accounts are for local development only.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
