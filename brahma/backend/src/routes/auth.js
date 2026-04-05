const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const authMW   = require('../middleware/auth');

const sign = (user) => jwt.sign(
  { id: user.id, handle: user.handle },
  process.env.JWT_SECRET || 'brahma_jwt_secret',
  { expiresIn: '30d' }
);

router.post('/register', async (req, res) => {
  const { username, handle, email, password } = req.body;
  if (!username || !handle || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const cleanHandle = handle.replace(/^@/, '').toLowerCase();
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO users (username, handle, email, password_hash)
       VALUES ($1,$2,$3,$4) RETURNING id,username,handle,email,bio,avatar_url,banner_url,verified,followers_count,following_count,tweets_count,created_at`,
      [username, cleanHandle, email.toLowerCase(), hash]
    );
    res.status(201).json({ token: sign(rows[0]), user: rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      const field = e.detail?.includes('handle') ? 'Handle' : 'Email';
      return res.status(409).json({ error: `${field} already taken` });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email?.toLowerCase()]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  const { password_hash, ...user } = rows[0];
  res.json({ token: sign(user), user });
});

router.get('/me', authMW, async (req, res) => {
  const { rows } = await db.query(
    'SELECT id,username,handle,email,bio,avatar_url,banner_url,location,website,verified,followers_count,following_count,tweets_count,created_at FROM users WHERE id=$1',
    [req.user.id]
  );
  res.json(rows[0] || null);
});

router.put('/me', authMW, async (req, res) => {
  const { username, bio, avatar_url, banner_url, location, website } = req.body;
  const { rows } = await db.query(
    `UPDATE users SET username=COALESCE($1,username), bio=COALESCE($2,bio),
     avatar_url=COALESCE($3,avatar_url), banner_url=COALESCE($4,banner_url),
     location=COALESCE($5,location), website=COALESCE($6,website)
     WHERE id=$7 RETURNING id,username,handle,email,bio,avatar_url,banner_url,location,website,verified,followers_count,following_count,tweets_count`,
    [username, bio, avatar_url, banner_url, location, website, req.user.id]
  );
  res.json(rows[0]);
});

module.exports = router;
