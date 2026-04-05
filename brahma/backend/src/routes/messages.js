const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// Get conversations (unique users I have exchanged messages with)
router.get('/conversations', auth, async (req, res) => {
  const { rows } = await db.query(`
    SELECT DISTINCT ON (other_user) other_user,
      u.username, u.handle, u.avatar_url, u.verified,
      dm.content AS last_message, dm.created_at, dm.read
    FROM (
      SELECT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS other_user,
             id, content, created_at, read
      FROM direct_messages WHERE sender_id=$1 OR receiver_id=$1
    ) dm JOIN users u ON u.id=dm.other_user
    ORDER BY other_user, dm.created_at DESC`, [req.user.id]);
  res.json(rows);
});

// Get messages with a specific user
router.get('/:userId', auth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM direct_messages
     WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
     ORDER BY created_at ASC LIMIT 100`, [req.user.id, req.params.userId]);
  await db.query('UPDATE direct_messages SET read=true WHERE receiver_id=$1 AND sender_id=$2', [req.user.id, req.params.userId]);
  res.json(rows);
});

// Send message
router.post('/:userId', auth, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message required' });
  const { rows } = await db.query(
    'INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES ($1,$2,$3) RETURNING *',
    [req.user.id, req.params.userId, content.trim()]
  );
  req.app.get('io')?.to(req.params.userId).emit('new_message', rows[0]);
  res.status(201).json(rows[0]);
});

module.exports = router;
