-- Netflix Clone — Database Schema & Seed Data

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color  VARCHAR(7)   DEFAULT '#E50914',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS genres (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS movies (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  thumbnail_url VARCHAR(600),
  banner_url    VARCHAR(600),
  video_url     VARCHAR(600) NOT NULL,
  duration_min  INT          DEFAULT 0,
  release_year  INT          DEFAULT 2023,
  maturity      VARCHAR(10)  DEFAULT 'PG-13',
  genre_id      INT,
  is_featured   TINYINT(1)   DEFAULT 0,
  watch_count   INT          DEFAULT 0,
  rating_avg    DECIMAL(3,1) DEFAULT 0.0,
  rating_count  INT          DEFAULT 0,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT     NOT NULL,
  movie_id   INT     NOT NULL,
  score      TINYINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_movie (user_id, movie_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT  NOT NULL,
  movie_id   INT  NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  user_id  INT NOT NULL,
  movie_id INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_watchlist (user_id, movie_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watch_history (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  movie_id     INT NOT NULL,
  progress_sec INT         DEFAULT 0,
  completed    TINYINT(1)  DEFAULT 0,
  last_watched TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_history (user_id, movie_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------
-- Seed: Genres
-- -----------------------------------------------------------------------
INSERT INTO genres (name) VALUES
  ('Action'), ('Drama'), ('Comedy'), ('Thriller'),
  ('Sci-Fi'), ('Documentary'), ('Romance'), ('Animation'), ('Horror');

-- -----------------------------------------------------------------------
-- Seed: Movies  (video URLs = Google public sample MP4s, always online)
-- poster = picsum.photos stable seed images
-- -----------------------------------------------------------------------
INSERT INTO movies (title, description, thumbnail_url, banner_url, video_url, duration_min, release_year, maturity, genre_id, is_featured, watch_count, rating_avg, rating_count) VALUES

-- Action (genre_id=1)
('Iron Vortex',
 'A rogue agent uncovers a global conspiracy that stretches from the streets of Gorakhpur to the halls of power. With time running out, he must choose between duty and survival.',
 'https://picsum.photos/seed/ironvortex/400/225','https://picsum.photos/seed/ironvortex/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
 14, 2023, 'PG-13', 1, 1, 540, 8.2, 89),

('Shadow Protocol',
 'When an elite black-ops unit goes dark, one woman must infiltrate enemy lines to bring them home — or bury them.',
 'https://picsum.photos/seed/shadowprotocol/400/225','https://picsum.photos/seed/shadowprotocol/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
 15, 2022, 'R', 1, 0, 320, 7.6, 44),

('Steel Tide',
 'Naval commandos race against a ticking clock to stop a rogue submarine from launching a devastating strike.',
 'https://picsum.photos/seed/steeltide/400/225','https://picsum.photos/seed/steeltide/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
 12, 2021, 'PG-13', 1, 0, 210, 7.1, 30),

-- Drama (genre_id=2)
('Tears of Tomorrow',
 'After a life-changing accident, a celebrated musician must rediscover herself through the small joys of an ordinary life.',
 'https://picsum.photos/seed/tearstomorrow/400/225','https://picsum.photos/seed/tearstomorrow/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
 13, 2023, 'PG', 2, 1, 610, 8.9, 120),

('The Last Harbor',
 'A grieving father sails across the Pacific to scatter his daughter\'s ashes at her favourite lighthouse — a journey that changes everything.',
 'https://picsum.photos/seed/lastharbor/400/225','https://picsum.photos/seed/lastharbor/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
 11, 2022, 'PG', 2, 0, 280, 8.4, 61),

('Broken Shores',
 'Two estranged siblings return to their coastal hometown and confront the secrets their family buried decades ago.',
 'https://picsum.photos/seed/brokenshores/400/225','https://picsum.photos/seed/brokenshores/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
 10, 2021, 'PG-13', 2, 0, 175, 7.8, 40),

-- Comedy (genre_id=3)
('Office Chaos',
 'When the company\'s entire HR department quits on the same day, one overeager intern must hold the office together.',
 'https://picsum.photos/seed/officechaos/400/225','https://picsum.photos/seed/officechaos/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
 14, 2023, 'PG-13', 3, 0, 390, 7.5, 72),

('Perfectly Imperfect',
 'A type-A wedding planner accidentally books the wrong venue, caterer, and band — then falls for the chaos.',
 'https://picsum.photos/seed/perfectlyimperfect/400/225','https://picsum.photos/seed/perfectlyimperfect/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
 15, 2022, 'PG', 3, 0, 260, 7.2, 51),

('Big Buck Adventures',
 'In a sun-drenched meadow, a giant rabbit befriends three unlikely companions — a squirrel, a duck, and a very confused butterfly.',
 'https://picsum.photos/seed/bigbuck/400/225','https://picsum.photos/seed/bigbuck/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
 10, 2023, 'G', 3, 0, 450, 8.0, 95),

-- Thriller (genre_id=4)
('The Cipher',
 'A cryptographer receives a message that only she can decode — and what it reveals will put everyone she loves at risk.',
 'https://picsum.photos/seed/thecipher/400/225','https://picsum.photos/seed/thecipher/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
 16, 2023, 'R', 4, 0, 310, 8.3, 67),

('Fractured Mind',
 'A detective with a fragmented memory must solve her own disappearance before the clock runs out.',
 'https://picsum.photos/seed/fracturedmind/400/225','https://picsum.photos/seed/fracturedmind/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
 13, 2022, 'R', 4, 0, 195, 7.9, 43),

-- Sci-Fi (genre_id=5)
('Galactic Drift',
 'The last crew of the colony ship Aurora must repair their vessel before it drifts beyond the edge of the known universe.',
 'https://picsum.photos/seed/galacticdrift/400/225','https://picsum.photos/seed/galacticdrift/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
 11, 2023, 'PG-13', 5, 0, 380, 8.1, 82),

('Neural Storm',
 'When a scientist uploads her consciousness to a dying network, she becomes the last firewall against a rogue AI.',
 'https://picsum.photos/seed/neuralstorm/400/225','https://picsum.photos/seed/neuralstorm/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
 14, 2022, 'PG-13', 5, 0, 220, 7.7, 38),

('Elephant Dreams',
 'Inside a dying machine, two robots argue about the nature of reality in a world that no longer needs them.',
 'https://picsum.photos/seed/elephantdreams/400/225','https://picsum.photos/seed/elephantdreams/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
 11, 2021, 'PG', 5, 0, 300, 8.6, 110),

-- Documentary (genre_id=6)
('Ocean\'s Silent Cry',
 'A breathtaking underwater expedition reveals the hidden lives of creatures in Earth\'s deepest trenches — and a warning we cannot ignore.',
 'https://picsum.photos/seed/oceansilentcry/400/225','https://picsum.photos/seed/oceansilentcry/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
 12, 2023, 'G', 6, 0, 155, 8.8, 74),

('Beyond the Peaks',
 'Three climbers attempt the world\'s most dangerous route in the dead of winter — only two will finish the story.',
 'https://picsum.photos/seed/beyondpeaks/400/225','https://picsum.photos/seed/beyondpeaks/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
 13, 2022, 'PG', 6, 0, 190, 8.5, 60),

-- Romance (genre_id=7)
('One Last Summer',
 'Two strangers stranded at a remote mountain inn discover they\'ve been missing the same person their entire lives — each other.',
 'https://picsum.photos/seed/onelastsummer/400/225','https://picsum.photos/seed/onelastsummer/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
 15, 2023, 'PG', 7, 0, 270, 7.4, 55),

('Letters Never Sent',
 'A woman discovers a box of unsent love letters in her late grandmother\'s attic, sparking a search for the man who wrote them.',
 'https://picsum.photos/seed/lettersneversent/400/225','https://picsum.photos/seed/lettersneversent/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
 11, 2022, 'PG', 7, 0, 185, 7.9, 42),

-- Animation (genre_id=8)
('Sintel\'s Quest',
 'A young girl ventures alone across a hostile world to rescue a small dragon she calls friend — in a tale of love and loss.',
 'https://picsum.photos/seed/sintelquest/400/225','https://picsum.photos/seed/sintelquest/1280/720',
 'https://media.w3.org/2010/05/sintel/trailer.mp4',
 15, 2023, 'PG', 8, 0, 420, 9.1, 140),

-- Horror (genre_id=9)
('The Hollow',
 'A group of urban explorers descend into an abandoned mine and unlock something that was meant to stay buried.',
 'https://picsum.photos/seed/thehollow/400/225','https://picsum.photos/seed/thehollow/1280/720',
 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
 12, 2023, 'R', 9, 0, 240, 7.3, 48);
