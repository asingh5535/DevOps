-- Gorakhpur Masti Planner — Database Schema & Seed Data (v1 + v2)

CREATE TABLE IF NOT EXISTS activities (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  emoji       VARCHAR(10)  DEFAULT '',
  category    ENUM('food','sightseeing','entertainment','shopping','transport') NOT NULL,
  cost        INT          DEFAULT 0,
  description TEXT,
  tags        JSON
);

CREATE TABLE IF NOT EXISTS combos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  activity_ids JSON,
  total_cost   INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS saved_plans (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255)      DEFAULT 'My Plan',
  activity_ids JSON,
  total_cost   INT               DEFAULT 0,
  created_at   TIMESTAMP         DEFAULT CURRENT_TIMESTAMP
);

-- V2: Healthcare tables
SOURCE /docker-entrypoint-initdb.d/v2_healthcare.sql;

-- -----------------------------------------------------------------------
-- Seed: Activities
-- -----------------------------------------------------------------------
INSERT INTO activities (name, emoji, category, cost, description, tags) VALUES
-- FOOD
('Rapti Ghat Street Food',    '🍢', 'food', 80,
 'Aloo tikki, chaat, golgappe & jalebi near Rapti Ghat. A local street food paradise.',
 '["street food","evening","family"]'),

('Terrace Cafe Gorakhpur',    '☕', 'food', 150,
 'Enjoy coffee, sandwiches and snacks at one of the popular cafes in the city.',
 '["café","chill","couple"]'),

('Litti Chokha Lunch',        '🫓', 'food', 60,
 'Authentic UP-Bihar style Litti Chokha — hearty, delicious and very local.',
 '["local cuisine","lunch"]'),

('Momo & Chowmein Corner',    '🥟', 'food', 70,
 'Popular momos and chowmein stalls near Golghar and Cinema Road.',
 '["snacks","quick bite"]'),

('Lassi & Rabri at Old City', '🥛', 'food', 50,
 'Famous thick lassi and rabri at the old bazaar lanes of Gorakhpur.',
 '["dessert","traditional"]'),

('Family Dinner – Local Dhaba','🍛', 'food', 200,
 'Full thali dinner (dal, sabzi, roti, rice, papad) at a popular local dhaba for 2 people.',
 '["dinner","family","filling"]'),

-- SIGHTSEEING
('Gorakhnath Temple',         '🛕', 'sightseeing', 0,
 'Visit the sacred Gorakhnath Temple — free entry, serene atmosphere, rich history.',
 '["free","spiritual","must-visit"]'),

('Ramgarh Tal Lakeside',      '🌊', 'sightseeing', 50,
 'Walk along the scenic Ramgarh Tal lake. Boating available at ₹50/person.',
 '["nature","boating","family"]'),

('Gorakhpur Zoo',             '🦁', 'sightseeing', 50,
 'Gorakhpur Zoological Park — great for families with kids. Entry ~₹50.',
 '["kids","family","nature"]'),

('Railway Museum Gorakhpur',  '🚂', 'sightseeing', 30,
 'Fascinating railway museum showcasing India\'s rail heritage. Entry ~₹30.',
 '["history","educational","kids"]'),

('Veer Bahadur Singh Planetarium','🌌','sightseeing', 60,
 'Explore the universe at Gorakhpur\'s planetarium. Shows on astronomy and space.',
 '["educational","science","family"]'),

('Regional Science Centre',   '🔬', 'sightseeing', 40,
 'Interactive science exhibits and displays — great for curious minds.',
 '["educational","kids","science"]'),

('GD Birla Dharamshala Area', '🏯', 'sightseeing', 0,
 'Heritage building and peaceful surroundings — free to explore and photograph.',
 '["free","heritage","photography"]'),

-- ENTERTAINMENT
('Movie at PVR/Local Cinema', '🎬', 'entertainment', 180,
 'Catch a Hindi film at one of Gorakhpur\'s cinema halls or multiplexes.',
 '["movie","evening","couple"]'),

('Ramgarh Tal Boating',       '⛵', 'entertainment', 100,
 'Pedal boat or row boat on Ramgarh Tal for 30 mins. Fun for all ages.',
 '["outdoor","fun","family"]'),

('Gaming Zone / Arcade',      '🎮', 'entertainment', 100,
 'Gaming arcades and play zones available at Golghar or malls.',
 '["games","youth","indoor"]'),

('Evening at City Mall',      '🏬', 'entertainment', 50,
 'Stroll through GKP mall, window shop, and enjoy the air-conditioned environment.',
 '["mall","casual","evening"]'),

('Cricket Ground / Sports',   '🏏', 'entertainment', 30,
 'Book a cricket ground slot or play at a local sports facility.',
 '["sports","outdoor","group"]'),

-- SHOPPING
('Golghar Market Shopping',   '🛒', 'shopping', 200,
 'Explore Gorakhpur\'s famous Golghar market for clothes, accessories & gifts.',
 '["market","clothes","bargain"]'),

('Local Handicrafts & Souvenirs','🎁','shopping', 100,
 'Buy local Gorakhpur terracotta and bamboo handicrafts as souvenirs.',
 '["gifts","local craft","unique"]'),

('Imlidih Textile Market',    '👕', 'shopping', 150,
 'Affordable clothing and fabric shopping at the local textile hub.',
 '["clothes","wholesale","budget"]'),

-- TRANSPORT
('City E-Rickshaw Rides',     '🛺', 'transport', 60,
 'Hop on e-rickshaws to commute between multiple spots. Budget ~₹60 for the day.',
 '["commute","budget","local"]'),

('Auto Rickshaw Day Pass',    '🚌', 'transport', 100,
 'Hire an auto for 3-4 hours to cover multiple locations comfortably.',
 '["comfortable","flexible","group"]'),

('Rapti Ghat to Zoo Cycle Ride','🚲','transport', 40,
 'Rent a bicycle for a few hours and explore the scenic routes.',
 '["eco-friendly","fun","healthy"]');

-- -----------------------------------------------------------------------
-- Seed: Combos  (activity_ids reference the IDs inserted above: 1-24)
-- -----------------------------------------------------------------------
INSERT INTO combos (name, description, activity_ids, total_cost) VALUES
('🌅 Perfect Family Day',
 'Gorakhnath Temple → Zoo → Ramgarh Tal Boating → Litti Chokha Lunch → Evening Chaat at Rapti Ghat',
 '[7,9,15,3,1,22]', 340),

('🎭 Fun-Packed Youth Day',
 'Movie → Gaming Zone → Momo Snacks → Golghar Shopping → Evening Cafe',
 '[14,16,4,19,2,22]', 660),

('💑 Couple''s Day Out',
 'Terrace Cafe brunch → Planetarium → Ramgarh Tal walk → Dinner at Dhaba',
 '[2,11,8,6,22]', 560),

('🧒 Kids Special Day',
 'Railway Museum → Science Centre → Zoo → Arcade Games → Street Food',
 '[10,12,9,16,4,22]', 350),

('🕌 Heritage & Culture Tour',
 'Gorakhnath Temple → GD Birla Area → Railway Museum → Planetarium → Litti Chokha + Lassi',
 '[7,13,10,11,3,5,22]', 250),

('🛍️ Shopping & Food Spree',
 'Golghar Market → Imlidih Textiles → Local Handicrafts → Cafe → Street Chaat',
 '[19,21,20,2,1,22]', 660);
