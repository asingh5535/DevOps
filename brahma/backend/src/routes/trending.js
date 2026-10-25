const router = require('express').Router();
const db     = require('../db');
const redis  = require('../redis');

router.get('/hashtags', async (req, res) => {
  const cached = await redis.get('trending:hashtags');
  if (cached) return res.json(JSON.parse(cached));
  const { rows } = await db.query('SELECT name, tweets_count FROM hashtags ORDER BY tweets_count DESC LIMIT 10');
  await redis.setex('trending:hashtags', 300, JSON.stringify(rows));
  res.json(rows);
});

module.exports = router;
