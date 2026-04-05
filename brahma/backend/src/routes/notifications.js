const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { rows } = await db.query(`
    SELECT n.*, u.username AS actor_name, u.handle AS actor_handle, u.avatar_url AS actor_avatar,
           t.content AS tweet_content
    FROM notifications n
    JOIN users u ON n.actor_id = u.id
    LEFT JOIN tweets t ON n.tweet_id = t.id
    WHERE n.user_id = $1
    ORDER BY n.created_at DESC LIMIT 50`, [req.user.id]);
  res.json(rows);
});

router.get('/unread-count', auth, async (req, res) => {
  const { rows } = await db.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read=false', [req.user.id]);
  res.json({ count: parseInt(rows[0].count) });
});

router.put('/read-all', auth, async (req, res) => {
  await db.query('UPDATE notifications SET read=true WHERE user_id=$1', [req.user.id]);
  res.json({ ok: true });
});

router.put('/:id/read', auth, async (req, res) => {
  await db.query('UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
