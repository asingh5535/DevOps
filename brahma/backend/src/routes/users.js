const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const jwt    = require('jsonwebtoken');

const viewerIdFromReq = req => {
  try {
    const h = req.headers.authorization;
    return h ? jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET || 'brahma_jwt_secret').id : null;
  } catch { return null; }
};

const TWEET_SELECT = (userId) => `
  SELECT t.*, u.username, u.handle, u.avatar_url, u.verified,
    ${userId
      ? `EXISTS(SELECT 1 FROM likes     WHERE user_id='${userId}' AND tweet_id=t.id) AS liked,
    EXISTS(SELECT 1 FROM retweets  WHERE user_id='${userId}' AND tweet_id=t.id) AS retweeted,
    EXISTS(SELECT 1 FROM bookmarks WHERE user_id='${userId}' AND tweet_id=t.id) AS bookmarked,`
      : 'false AS liked, false AS retweeted, false AS bookmarked,'}
    null AS reply_to
  FROM tweets t JOIN users u ON t.user_id=u.id`;

// ── Static routes MUST come before /:param routes ──────────────────────────

// Who to follow
router.get('/suggestions/who-to-follow', auth, async (req, res) => {
  const { rows } = await db.query(`
    SELECT id,username,handle,avatar_url,bio,verified FROM users
    WHERE id != $1 AND id NOT IN (SELECT following_id FROM follows WHERE follower_id=$1)
    ORDER BY followers_count DESC LIMIT 5`, [req.user.id]);
  res.json(rows);
});

// Update my profile
router.patch('/me', auth, async (req, res) => {
  const { bio, avatar_url, banner_url, location, website } = req.body;
  const { rows } = await db.query(
    `UPDATE users SET
      bio        = COALESCE($2, bio),
      avatar_url = COALESCE($3, avatar_url),
      banner_url = COALESCE($4, banner_url),
      location   = COALESCE($5, location),
      website    = COALESCE($6, website)
    WHERE id=$1
    RETURNING id,username,handle,email,bio,avatar_url,banner_url,location,website,verified,followers_count,following_count,tweets_count`,
    [req.user.id, bio || null, avatar_url || null, banner_url || null, location || null, website || null]
  );
  res.json(rows[0]);
});

// Get user by numeric/UUID id (used in Messages)
router.get('/id/:userId', async (req, res) => {
  const { rows } = await db.query(
    'SELECT id,username,handle,avatar_url,bio,verified FROM users WHERE id=$1',
    [req.params.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// ── Dynamic :handle / :id routes ───────────────────────────────────────────

// Get profile by handle
router.get('/:handle', async (req, res) => {
  const { rows } = await db.query(
    'SELECT id,username,handle,email,bio,avatar_url,banner_url,location,website,verified,followers_count,following_count,tweets_count,created_at FROM users WHERE handle=$1',
    [req.params.handle.replace(/^@/, '').toLowerCase()]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// Get user's tweets
router.get('/:handle/tweets', async (req, res) => {
  const viewerId = viewerIdFromReq(req);
  const { rows: user } = await db.query('SELECT id FROM users WHERE handle=$1', [req.params.handle.toLowerCase()]);
  if (!user[0]) return res.status(404).json({ error: 'User not found' });
  const { rows } = await db.query(`${TWEET_SELECT(viewerId)} WHERE t.user_id=$1 ORDER BY t.created_at DESC LIMIT 50`, [user[0].id]);
  res.json(rows);
});

// Follow user
router.post('/:id/follow', auth, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    await db.query('INSERT INTO follows (follower_id, following_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    await db.query('UPDATE users SET followers_count=followers_count+1 WHERE id=$1', [req.params.id]);
    await db.query('UPDATE users SET following_count=following_count+1 WHERE id=$1', [req.user.id]);
    await db.query('INSERT INTO notifications (user_id,actor_id,type) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.params.id, req.user.id, 'follow']);
    req.app.get('io')?.to(req.params.id).emit('notification', { type: 'follow', actor_id: req.user.id });
    res.json({ following: true });
  } catch { res.status(409).json({ error: 'Already following' }); }
});

// Unfollow user
router.delete('/:id/follow', auth, async (req, res) => {
  await db.query('DELETE FROM follows WHERE follower_id=$1 AND following_id=$2', [req.user.id, req.params.id]);
  await db.query('UPDATE users SET followers_count=GREATEST(followers_count-1,0) WHERE id=$1', [req.params.id]);
  await db.query('UPDATE users SET following_count=GREATEST(following_count-1,0) WHERE id=$1', [req.user.id]);
  res.json({ following: false });
});

// Check if following
router.get('/:id/is-following', auth, async (req, res) => {
  const { rows } = await db.query('SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2', [req.user.id, req.params.id]);
  res.json({ following: rows.length > 0 });
});

// Followers list
router.get('/:handle/followers', async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.id,u.username,u.handle,u.avatar_url,u.bio,u.verified FROM users u
    JOIN follows f ON f.follower_id=u.id
    JOIN users uf ON uf.id=f.following_id WHERE uf.handle=$1`, [req.params.handle.toLowerCase()]);
  res.json(rows);
});

// Following list
router.get('/:handle/following', async (req, res) => {
  const { rows } = await db.query(`
    SELECT u.id,u.username,u.handle,u.avatar_url,u.bio,u.verified FROM users u
    JOIN follows f ON f.following_id=u.id
    JOIN users uf ON uf.id=f.follower_id WHERE uf.handle=$1`, [req.params.handle.toLowerCase()]);
  res.json(rows);
});

module.exports = router;
