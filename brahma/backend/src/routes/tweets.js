const router = require('express').Router();
const db     = require('../db');
const redis  = require('../redis');
const auth   = require('../middleware/auth');

const TWEET_SELECT = (userId) => `
  SELECT t.*,
    u.username, u.handle, u.avatar_url, u.verified,
    ${userId ? `EXISTS(SELECT 1 FROM likes     WHERE user_id='${userId}' AND tweet_id=t.id) AS liked,
    EXISTS(SELECT 1 FROM retweets  WHERE user_id='${userId}' AND tweet_id=t.id) AS retweeted,
    EXISTS(SELECT 1 FROM bookmarks WHERE user_id='${userId}' AND tweet_id=t.id) AS bookmarked,` : 'false AS liked, false AS retweeted, false AS bookmarked,'}
    CASE WHEN t.reply_to_id IS NOT NULL THEN (
      SELECT json_build_object('id',rt.id,'content',rt.content,'username',ru.username,'handle',ru.handle,'avatar_url',ru.avatar_url)
      FROM tweets rt JOIN users ru ON rt.user_id=ru.id WHERE rt.id=t.reply_to_id
    ) END AS reply_to
  FROM tweets t JOIN users u ON t.user_id=u.id`;

async function extractHashtags(tweetId, content) {
  const tags = [...new Set((content.match(/#(\w+)/g) || []).map(t => t.slice(1).toLowerCase()))];
  for (const name of tags) {
    const { rows } = await db.query(
      `INSERT INTO hashtags (name, tweets_count) VALUES ($1, 1)
       ON CONFLICT (name) DO UPDATE SET tweets_count = hashtags.tweets_count + 1 RETURNING id`,
      [name]
    );
    await db.query('INSERT INTO tweet_hashtags (tweet_id, hashtag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [tweetId, rows[0].id]);
  }
}

async function createNotification(io, userId, actorId, type, tweetId = null) {
  if (userId === actorId) return;
  const { rows } = await db.query(
    'INSERT INTO notifications (user_id, actor_id, type, tweet_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [userId, actorId, type, tweetId]
  );
  const { rows: actor } = await db.query('SELECT username, handle, avatar_url FROM users WHERE id=$1', [actorId]);
  io?.to(userId).emit('notification', { ...rows[0], actor: actor[0] });
}

// Home timeline
router.get('/timeline', auth, async (req, res) => {
  const cacheKey = `timeline:${req.user.id}`;
  const cached   = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const { rows } = await db.query(`
    ${TWEET_SELECT(req.user.id)}
    WHERE t.user_id IN (SELECT following_id FROM follows WHERE follower_id=$1 UNION SELECT $1::uuid)
      AND t.retweet_of_id IS NULL
    ORDER BY t.created_at DESC LIMIT 50`, [req.user.id]);

  await redis.setex(cacheKey, 60, JSON.stringify(rows));
  res.json(rows);
});

// Explore — all tweets
router.get('/', async (req, res) => {
  const userId = req.headers.authorization ? (() => {
    try { const jwt = require('jsonwebtoken'); return jwt.verify(req.headers.authorization.replace('Bearer ',''), process.env.JWT_SECRET||'brahma_jwt_secret').id; } catch { return null; }
  })() : null;
  const { rows } = await db.query(`
    ${TWEET_SELECT(userId)}
    WHERE t.retweet_of_id IS NULL
    ORDER BY t.created_at DESC LIMIT 50`);
  res.json(rows);
});

// Create tweet
router.post('/', auth, async (req, res) => {
  const { content, reply_to_id, retweet_of_id, media_url } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  if (content.length > 280) return res.status(400).json({ error: 'Max 280 characters' });

  await redis.del(`timeline:${req.user.id}`);

  const { rows } = await db.query(
    `INSERT INTO tweets (user_id, content, reply_to_id, retweet_of_id, media_url)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, content.trim(), reply_to_id || null, retweet_of_id || null, media_url || null]
  );
  const tweet = rows[0];

  await db.query('UPDATE users SET tweets_count = tweets_count + 1 WHERE id=$1', [req.user.id]);
  await extractHashtags(tweet.id, content);

  if (reply_to_id) {
    await db.query('UPDATE tweets SET replies_count = replies_count + 1 WHERE id=$1', [reply_to_id]);
    const { rows: orig } = await db.query('SELECT user_id FROM tweets WHERE id=$1', [reply_to_id]);
    if (orig[0]) await createNotification(req.app.get('io'), orig[0].user_id, req.user.id, 'reply', tweet.id);
  }

  // Check for @mentions
  const mentions = [...new Set((content.match(/@(\w+)/g) || []).map(m => m.slice(1).toLowerCase()))];
  for (const handle of mentions) {
    const { rows: mentioned } = await db.query('SELECT id FROM users WHERE handle=$1', [handle]);
    if (mentioned[0]) await createNotification(req.app.get('io'), mentioned[0].id, req.user.id, 'mention', tweet.id);
  }

  const { rows: full } = await db.query(`${TWEET_SELECT(req.user.id)} WHERE t.id=$1`, [tweet.id]);
  req.app.get('io').emit('new_tweet', full[0]);
  res.status(201).json(full[0]);
});

// Delete tweet
router.delete('/:id', auth, async (req, res) => {
  const { rowCount } = await db.query('DELETE FROM tweets WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  if (!rowCount) return res.status(404).json({ error: 'Tweet not found or not yours' });
  await db.query('UPDATE users SET tweets_count = GREATEST(tweets_count-1,0) WHERE id=$1', [req.user.id]);
  await redis.del(`timeline:${req.user.id}`);
  res.json({ deleted: req.params.id });
});

// Like / Unlike
router.post('/:id/like', auth, async (req, res) => {
  try {
    await db.query('INSERT INTO likes (user_id, tweet_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    const { rows } = await db.query('UPDATE tweets SET likes_count=likes_count+1 WHERE id=$1 RETURNING user_id,likes_count', [req.params.id]);
    await createNotification(req.app.get('io'), rows[0].user_id, req.user.id, 'like', req.params.id);
    res.json({ liked: true, likes_count: rows[0].likes_count });
  } catch { res.status(409).json({ error: 'Already liked' }); }
});

router.delete('/:id/like', auth, async (req, res) => {
  await db.query('DELETE FROM likes WHERE user_id=$1 AND tweet_id=$2', [req.user.id, req.params.id]);
  const { rows } = await db.query('UPDATE tweets SET likes_count=GREATEST(likes_count-1,0) WHERE id=$1 RETURNING likes_count', [req.params.id]);
  res.json({ liked: false, likes_count: rows[0]?.likes_count });
});

// Retweet / Unretweet
router.post('/:id/retweet', auth, async (req, res) => {
  try {
    await db.query('INSERT INTO retweets (user_id, tweet_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    const { rows } = await db.query('UPDATE tweets SET retweets_count=retweets_count+1 WHERE id=$1 RETURNING user_id,retweets_count', [req.params.id]);
    await createNotification(req.app.get('io'), rows[0].user_id, req.user.id, 'retweet', req.params.id);
    res.json({ retweeted: true, retweets_count: rows[0].retweets_count });
  } catch { res.status(409).json({ error: 'Already retweeted' }); }
});

router.delete('/:id/retweet', auth, async (req, res) => {
  await db.query('DELETE FROM retweets WHERE user_id=$1 AND tweet_id=$2', [req.user.id, req.params.id]);
  const { rows } = await db.query('UPDATE tweets SET retweets_count=GREATEST(retweets_count-1,0) WHERE id=$1 RETURNING retweets_count', [req.params.id]);
  res.json({ retweeted: false, retweets_count: rows[0]?.retweets_count });
});

// Bookmark
router.post('/:id/bookmark', auth, async (req, res) => {
  try {
    await db.query('INSERT INTO bookmarks (user_id, tweet_id) VALUES ($1,$2)', [req.user.id, req.params.id]);
    await db.query('UPDATE tweets SET bookmarks_count=bookmarks_count+1 WHERE id=$1', [req.params.id]);
    res.json({ bookmarked: true });
  } catch { res.status(409).json({ error: 'Already bookmarked' }); }
});

router.delete('/:id/bookmark', auth, async (req, res) => {
  await db.query('DELETE FROM bookmarks WHERE user_id=$1 AND tweet_id=$2', [req.user.id, req.params.id]);
  await db.query('UPDATE tweets SET bookmarks_count=GREATEST(bookmarks_count-1,0) WHERE id=$1', [req.params.id]);
  res.json({ bookmarked: false });
});

// Replies for a tweet
router.get('/:id/replies', async (req, res) => {
  const userId = null;
  const { rows } = await db.query(`${TWEET_SELECT(userId)} WHERE t.reply_to_id=$1 ORDER BY t.created_at ASC`, [req.params.id]);
  res.json(rows);
});

// Single tweet
router.get('/:id', async (req, res) => {
  const { rows } = await db.query(`${TWEET_SELECT(null)} WHERE t.id=$1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await db.query('UPDATE tweets SET views_count=views_count+1 WHERE id=$1', [req.params.id]);
  res.json(rows[0]);
});

// User bookmarks
router.get('/user/bookmarks', auth, async (req, res) => {
  const { rows } = await db.query(`
    ${TWEET_SELECT(req.user.id)}
    JOIN bookmarks b ON b.tweet_id=t.id WHERE b.user_id=$1 ORDER BY b.created_at DESC`, [req.user.id]);
  res.json(rows);
});

module.exports = router;
