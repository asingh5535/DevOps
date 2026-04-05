-- Brahma (Twitter Clone) — PostgreSQL Schema & Seed Data

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  username        VARCHAR(50) NOT NULL,
  handle          VARCHAR(50) NOT NULL UNIQUE,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  bio             TEXT        DEFAULT '',
  avatar_url      TEXT        DEFAULT '',
  banner_url      TEXT        DEFAULT '',
  location        VARCHAR(100) DEFAULT '',
  website         VARCHAR(200) DEFAULT '',
  followers_count INT         DEFAULT 0,
  following_count INT         DEFAULT 0,
  tweets_count    INT         DEFAULT 0,
  verified        BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMP   DEFAULT NOW()
);

-- ── Tweets ─────────────────────────────────────────────────────────────────
CREATE TABLE tweets (
  id               UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content          TEXT      NOT NULL CHECK (char_length(content) <= 280),
  media_url        TEXT      DEFAULT NULL,
  reply_to_id      UUID      DEFAULT NULL REFERENCES tweets(id) ON DELETE SET NULL,
  retweet_of_id    UUID      DEFAULT NULL REFERENCES tweets(id) ON DELETE SET NULL,
  likes_count      INT       DEFAULT 0,
  retweets_count   INT       DEFAULT 0,
  replies_count    INT       DEFAULT 0,
  bookmarks_count  INT       DEFAULT 0,
  views_count      INT       DEFAULT 0,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tweets_user    ON tweets(user_id);
CREATE INDEX idx_tweets_created ON tweets(created_at DESC);
CREATE INDEX idx_tweets_content ON tweets USING gin(to_tsvector('english', content));

-- ── Follows ────────────────────────────────────────────────────────────────
CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- ── Likes ──────────────────────────────────────────────────────────────────
CREATE TABLE likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tweet_id   UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, tweet_id)
);

-- ── Retweets ───────────────────────────────────────────────────────────────
CREATE TABLE retweets (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tweet_id   UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, tweet_id)
);

-- ── Bookmarks ──────────────────────────────────────────────────────────────
CREATE TABLE bookmarks (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tweet_id   UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, tweet_id)
);

-- ── Hashtags ───────────────────────────────────────────────────────────────
CREATE TABLE hashtags (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL UNIQUE,
  tweets_count INT DEFAULT 0
);

CREATE TABLE tweet_hashtags (
  tweet_id   UUID NOT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  hashtag_id INT  NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (tweet_id, hashtag_id)
);

-- ── Notifications ──────────────────────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(20) NOT NULL,  -- like|retweet|follow|mention|reply
  tweet_id   UUID DEFAULT NULL REFERENCES tweets(id) ON DELETE CASCADE,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Direct Messages ────────────────────────────────────────────────────────
CREATE TABLE direct_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── Seed: Demo Users (password = "brahma123" for all) ─────────────────────
-- Hash generated with bcryptjs rounds=10 for "brahma123"
INSERT INTO users (username, handle, email, password_hash, bio, avatar_url, banner_url, verified, followers_count, following_count, tweets_count) VALUES
('Brahma Admin',  'brahma',    'brahma@demo.com',  '$2a$10$uY7k.Orw2HZ75R4oEDv3BeS87JOpn4cP/YQRU5xvjhZBd71b7DtQ2', 'The official Brahma account 🕉️', 'https://picsum.photos/seed/brahma/100/100',    'https://picsum.photos/seed/brahma-banner/1500/500',   TRUE,  1200, 300, 50),
('Abhishek Singh','abhishek',  'abhishek@demo.com','$2a$10$uY7k.Orw2HZ75R4oEDv3BeS87JOpn4cP/YQRU5xvjhZBd71b7DtQ2', 'Developer | Building cool things 🚀', 'https://picsum.photos/seed/abhishek/100/100', 'https://picsum.photos/seed/abhishek-banner/1500/500', TRUE,  850,  420, 120),
('Priya Sharma',  'priyasharma','priya@demo.com',  '$2a$10$uY7k.Orw2HZ75R4oEDv3BeS87JOpn4cP/YQRU5xvjhZBd71b7DtQ2', 'Designer ✏️ | Coffee lover ☕', 'https://picsum.photos/seed/priya/100/100',    'https://picsum.photos/seed/priya-banner/1500/500',    FALSE, 430,  210, 80),
('Rahul Gupta',   'rahulgupta','rahul@demo.com',   '$2a$10$uY7k.Orw2HZ75R4oEDv3BeS87JOpn4cP/YQRU5xvjhZBd71b7DtQ2', 'Tech enthusiast | Gorakhpur 🌿', 'https://picsum.photos/seed/rahul/100/100',    'https://picsum.photos/seed/rahul-banner/1500/500',    FALSE, 280,  190, 65),
('Neha Verma',    'nehaverma', 'neha@demo.com',    '$2a$10$uY7k.Orw2HZ75R4oEDv3BeS87JOpn4cP/YQRU5xvjhZBd71b7DtQ2', 'Photographer 📷 | Travel lover ✈️', 'https://picsum.photos/seed/neha/100/100',    'https://picsum.photos/seed/neha-banner/1500/500',     FALSE, 620,  310, 95);

-- ── Seed: Follows ──────────────────────────────────────────────────────────
INSERT INTO follows (follower_id, following_id)
SELECT a.id, b.id FROM users a, users b WHERE a.handle='abhishek' AND b.handle='brahma';
INSERT INTO follows (follower_id, following_id)
SELECT a.id, b.id FROM users a, users b WHERE a.handle='abhishek' AND b.handle='priyasharma';
INSERT INTO follows (follower_id, following_id)
SELECT a.id, b.id FROM users a, users b WHERE a.handle='abhishek' AND b.handle='rahulgupta';
INSERT INTO follows (follower_id, following_id)
SELECT a.id, b.id FROM users a, users b WHERE a.handle='priyasharma' AND b.handle='abhishek';
INSERT INTO follows (follower_id, following_id)
SELECT a.id, b.id FROM users a, users b WHERE a.handle='rahulgupta' AND b.handle='abhishek';
INSERT INTO follows (follower_id, following_id)
SELECT a.id, b.id FROM users a, users b WHERE a.handle='nehaverma' AND b.handle='abhishek';
INSERT INTO follows (follower_id, following_id)
SELECT a.id, b.id FROM users a, users b WHERE a.handle='brahma' AND b.handle='abhishek';

-- ── Seed: Hashtags ─────────────────────────────────────────────────────────
INSERT INTO hashtags (name, tweets_count) VALUES
('Brahma', 45), ('BuildInPublic', 38), ('OpenSource', 32),
('Gorakhpur', 28), ('DevOps', 24), ('Docker', 21),
('React', 18), ('NodeJS', 16), ('PostgreSQL', 14), ('WebDev', 40);

-- ── Seed: Tweets ──────────────────────────────────────────────────────────
WITH u AS (SELECT id, handle FROM users)
INSERT INTO tweets (user_id, content, likes_count, retweets_count, replies_count, views_count) VALUES
((SELECT id FROM u WHERE handle='brahma'),
 'Welcome to Brahma 🕉️ — the home of real conversations. Built with ❤️ and powered by #Docker #DevOps',
 142, 58, 24, 5400),

((SELECT id FROM u WHERE handle='abhishek'),
 'Just launched Brahma — a Twitter-like platform built with React, Node.js, PostgreSQL and Redis. Full DevOps stack with Docker Compose 🚀 #BuildInPublic #DevOps #Docker',
 89, 34, 18, 2100),

((SELECT id FROM u WHERE handle='priyasharma'),
 'The new UI for Brahma is live! Dark mode, smooth animations, and fully responsive. What do you think? 🎨 #WebDev #React',
 67, 21, 15, 1800),

((SELECT id FROM u WHERE handle='rahulgupta'),
 'Gorakhpur ke developers — aao Brahma pe! Real-time tweets, hashtags, DMs sab kuch hai 🌿 #Gorakhpur #BuildInPublic',
 43, 15, 9, 980),

((SELECT id FROM u WHERE handle='nehaverma'),
 'Capturing every moment. Life is too short to not share your story. #Photography #Travel ✈️📷',
 78, 22, 12, 2300),

((SELECT id FROM u WHERE handle='brahma'),
 'Brahma tip 💡: Use #hashtags to join trending conversations. Your voice matters here.',
 55, 18, 7, 1600),

((SELECT id FROM u WHERE handle='abhishek'),
 'PostgreSQL full-text search is incredibly powerful. Used it to build Brahma''s tweet search — no Elasticsearch needed for this scale! #PostgreSQL #NodeJS',
 102, 45, 28, 3200),

((SELECT id FROM u WHERE handle='priyasharma'),
 'Hot take: Good design is invisible. You only notice when it''s bad. Focus on the experience, not the aesthetics. #WebDev #UX',
 134, 62, 31, 4100),

((SELECT id FROM u WHERE handle='rahulgupta'),
 'Docker changed how I deploy apps forever. Build once, run anywhere is genuinely true ✅ #Docker #DevOps #OpenSource',
 91, 37, 19, 2700),

((SELECT id FROM u WHERE handle='nehaverma'),
 'Some places you visit once and they stay with you forever. That golden hour in the mountains 🏔️ #Travel #Photography',
 156, 48, 22, 5800),

((SELECT id FROM u WHERE handle='brahma'),
 'Milestone 🎯 — 1000 users in 24 hours! Thank you for making Brahma your home. RT to spread the word 🙏 #Brahma',
 203, 89, 45, 7200),

((SELECT id FROM u WHERE handle='abhishek'),
 'Redis is doing the heavy lifting for Brahma''s real-time feed caching. Response times under 10ms. Love it! ⚡ #NodeJS #Redis',
 77, 29, 14, 2100),

((SELECT id FROM u WHERE handle='priyasharma'),
 'Just finished the notification system for Brahma. Likes, retweets, follows — all real-time via Socket.io 🔔 #React #BuildInPublic',
 58, 20, 11, 1500),

((SELECT id FROM u WHERE handle='rahulgupta'),
 'Open source is not just a license — it''s a mindset of giving back. Contribute today 💻 #OpenSource #DevOps',
 65, 28, 8, 1900),

((SELECT id FROM u WHERE handle='nehaverma'),
 'Reminder: Take breaks. Go outside. Talk to people. The internet will still be here when you get back 🌿',
 189, 74, 36, 6300);

-- Link hashtags to tweets (sample)
WITH t AS (SELECT id FROM tweets ORDER BY created_at LIMIT 1),
     h AS (SELECT id FROM hashtags WHERE name IN ('Docker','DevOps'))
INSERT INTO tweet_hashtags (tweet_id, hashtag_id)
SELECT t.id, h.id FROM t, h;
