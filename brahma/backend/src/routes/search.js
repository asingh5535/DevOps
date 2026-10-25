const router = require('express').Router();
const db     = require('../db');

router.get('/tweets', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);
  const { rows } = await db.query(`
    SELECT t.*, u.username, u.handle, u.avatar_url, u.verified,
      false AS liked, false AS retweeted, false AS bookmarked, null AS reply_to
    FROM tweets t JOIN users u ON t.user_id=u.id
    WHERE to_tsvector('english', t.content) @@ plainto_tsquery('english', $1)
       OR t.content ILIKE $2
    ORDER BY t.created_at DESC LIMIT 30`, [q, `%${q}%`]);
  res.json(rows);
});

router.get('/users', async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json([]);
  const { rows } = await db.query(
    `SELECT id,username,handle,avatar_url,bio,verified,followers_count FROM users
     WHERE username ILIKE $1 OR handle ILIKE $1 ORDER BY followers_count DESC LIMIT 10`,
    [`%${q}%`]
  );
  res.json(rows);
});

module.exports = router;
