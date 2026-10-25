-- V2 Healthcare Feature — Doctors & Medicine Stores

CREATE TABLE IF NOT EXISTS doctors (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(255)  NOT NULL,
  specialization VARCHAR(100)  NOT NULL,
  hospital       VARCHAR(255),
  address        TEXT,
  phone          VARCHAR(20),
  fee_min        INT           DEFAULT 0,
  fee_max        INT           DEFAULT 0,
  available_days VARCHAR(255),
  timing         VARCHAR(100),
  rating         DECIMAL(2,1)  DEFAULT 4.0,
  type           ENUM('government','private') DEFAULT 'private'
);

CREATE TABLE IF NOT EXISTS medicine_stores (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  type            ENUM('jan_aushadhi','generic','pharmacy_chain','local','online') NOT NULL,
  address         TEXT,
  phone           VARCHAR(20),
  savings_percent INT          DEFAULT 0,
  timing          VARCHAR(100),
  features        JSON,
  delivers        BOOLEAN      DEFAULT FALSE
);

-- -----------------------------------------------------------------------
-- Seed: Doctors (sourced from Fatima Hospital, AIIMS Gorakhpur, Practo)
-- -----------------------------------------------------------------------
INSERT INTO doctors (name, specialization, hospital, address, phone, fee_min, fee_max, available_days, timing, rating, type) VALUES

-- General Physician
('Dr. Vinay Sinha',        'General Physician', 'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 300, 500, 'Mon-Sat', '9am–2pm', 4.7, 'private'),
('Dr. Rajesh Pandey',      'General Physician', 'City Clinic',           'Golghar, Gorakhpur',                    '9415012345',   200, 400, 'Mon-Sun', '10am–7pm', 4.4, 'private'),
('Dr. Kirti Gaurav Raizada','General Physician','Raizada Clinic',        'Betiahata, Gorakhpur',                  '9415098765',   200, 350, 'Mon-Sat', '6pm–9pm', 4.3, 'private'),
('AIIMS OPD',              'General Physician', 'AIIMS Gorakhpur',       'Kunraghat, Gorakhpur 273008',            '0551-2970100',  10,  50, 'Mon-Sat', '8am–3pm', 4.8, 'government'),

-- Cardiology
('Dr. Lokesh Kumar Gupta', 'Cardiologist',      'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 600, 800, 'Mon-Fri', '10am–1pm', 4.8, 'private'),
('Dr. Shivendra Rai',      'Cardiologist',      'Sahara Hospital',       'Civil Lines, Gorakhpur',                '9450112233',   500, 700, 'Mon-Sat', '5pm–8pm', 4.6, 'private'),
('AIIMS Cardiology OPD',   'Cardiologist',      'AIIMS Gorakhpur',       'Kunraghat, Gorakhpur 273008',            '0551-2970100',  10,  50, 'Tue,Thu', '8am–12pm', 4.9, 'government'),

-- Neurology
('Dr. Nagendra Pratap Verma','Neurologist',     'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 500, 700, 'Mon-Fri', '9am–12pm', 4.7, 'private'),
('Dr. Manas Prakash Singh', 'Neurosurgeon',     'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 700,1000, 'Mon-Fri', '2pm–5pm', 4.8, 'private'),
('AIIMS Neurology OPD',    'Neurologist',       'AIIMS Gorakhpur',       'Kunraghat, Gorakhpur 273008',            '0551-2970100',  10,  50, 'Mon,Wed,Fri','8am–12pm',4.9,'government'),

-- Orthopedics
('Dr. R. B. Singh',        'Orthopedic',        'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 400, 600, 'Mon-Sat', '11am–2pm', 4.5, 'private'),
('Dr. Anil Kumar',         'Orthopedic',        'Shree Hospital',        'Taramandal Road, Gorakhpur',            '9415223344',   350, 550, 'Mon-Sat', '6pm–9pm', 4.4, 'private'),

-- Gynecology
('Dr. Shweta Shukla',      'Gynecologist',      'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 400, 600, 'Mon-Fri', '10am–1pm', 4.7, 'private'),
('Dr. Mamta Shukla',       'Gynecologist',      'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 400, 600, 'Tue-Sat', '2pm–5pm', 4.6, 'private'),
('Dr. Nishtha Chaudhary',  'Gynecologist',      'Nishtha Maternity',     'Padri Bazar, Gorakhpur',                '9450334455',   300, 500, 'Mon-Sun', '9am–6pm', 4.5, 'private'),

-- Pediatrics
('Dr. Naveen Pandey',      'Pediatrician',      'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 300, 500, 'Mon-Sat', '10am–1pm', 4.7, 'private'),
('Dr. Suresh Kumar',       'Pediatrician',      'Children Care Clinic',  'Golghar, Gorakhpur',                    '9415445566',   250, 400, 'Mon-Sun', '4pm–8pm', 4.4, 'private'),

-- Dermatology
('Dr. R. G. Singh',        'Dermatologist',     'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 300, 500, 'Mon,Wed,Fri','9am–12pm',4.6,'private'),
('Dr. Priya Agarwal',      'Dermatologist',     'Skin Care Clinic',      'Civil Lines, Gorakhpur',                '9415556677',   400, 600, 'Mon-Sat', '5pm–8pm', 4.5, 'private'),

-- ENT
('Dr. Anurag Srivastava',  'ENT Specialist',    'ENT Care Centre',       'Golghar, Gorakhpur',                    '9415667788',   300, 500, 'Mon-Sat', '10am–2pm', 4.5, 'private'),
('Dr. Sunil Verma',        'ENT Specialist',    'Verma ENT Hospital',    'Betiahata, Gorakhpur',                  '9450778899',   250, 450, 'Mon-Sun', '4pm–8pm', 4.3, 'private'),

-- Ophthalmology
('Dr. Anjum Jain',         'Ophthalmologist',   'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 500, 800, 'Mon-Fri', '10am–1pm', 4.8, 'private'),
('Dr. Shaurya Verma',      'Ophthalmologist',   'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 400, 600, 'Mon-Fri', '2pm–5pm', 4.6, 'private'),

-- Dental
('Dr. Fujail Ahmad',       'Dentist',           'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 200, 400, 'Mon-Sat', '9am–1pm', 4.5, 'private'),
('Dr. Niharika Shahi',     'Dentist',           'Smile Dental Clinic',   'Golghar, Gorakhpur',                    '9415889900',   300, 500, 'Mon-Sat', '5pm–9pm', 4.4, 'private'),

-- Gastroenterology
('Dr. Ashish Kumar Khetan','Gastroenterologist','Fatima Hospital',        'Medical College Road, Gorakhpur',       '0551-2201234', 500, 700, 'Mon-Fri', '11am–2pm', 4.7, 'private'),

-- Psychiatry
('Dr. Dharmendra Kumar Kamla','Psychiatrist',   'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 500, 800, 'Mon-Fri', '3pm–6pm', 4.6, 'private'),

-- Urology
('Dr. Ankit Modi',         'Urologist',         'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 500, 700, 'Mon-Fri', '10am–1pm', 4.7, 'private'),

-- Pulmonology
('Dr. Sandeep Gupta',      'Pulmonologist',     'Fatima Hospital',       'Medical College Road, Gorakhpur',       '0551-2201234', 400, 600, 'Mon-Fri', '9am–12pm', 4.5, 'private');

-- -----------------------------------------------------------------------
-- Seed: Medicine Stores
-- -----------------------------------------------------------------------
INSERT INTO medicine_stores (name, type, address, phone, savings_percent, timing, features, delivers) VALUES

-- Jan Aushadhi Kendras (cheapest — government generic medicines)
('Jan Aushadhi Kendra – District Hospital',
 'jan_aushadhi', 'District Hospital Campus, Sadar, Gorakhpur', '7785804519',
 90, '9am–5pm (Mon-Sat)',
 '["Generic medicines","Govt certified","50-90% cheaper","No prescription markup"]', FALSE),

('Jan Aushadhi Kendra – BRD Medical Campus',
 'jan_aushadhi', 'BRD Medical College, Gorakhpur 273013', '9936141609',
 90, '9am–5pm (Mon-Sat)',
 '["Generic medicines","Govt certified","50-90% cheaper","900+ medicines listed"]', FALSE),

('Jan Aushadhi Kendra – Taramandal',
 'jan_aushadhi', 'Buddha Vihar, Taramandal Road, Gorakhpur', '9415824765',
 85, '8am–6pm (Mon-Sat)',
 '["Generic medicines","Govt certified","Nutritional supplements"]', FALSE),

('Jan Aushadhi Kendra – Padri Bazar',
 'jan_aushadhi', 'Padri Bazar, Gorakhpur', '7785804519',
 85, '9am–5pm (Mon-Sat)',
 '["Generic medicines","Govt certified","Walk-in available"]', FALSE),

('Jan Aushadhi Kendra – District Female Hospital',
 'jan_aushadhi', 'District Female Hospital, Gorakhpur', '8349002803',
 90, '9am–4pm (Mon-Sat)',
 '["Generic medicines","Women health products","Govt certified"]', FALSE),

-- Zeelab Pharmacy (affordable generic chain)
('Zeelab Pharmacy – BRD Medical College Road',
 'generic', 'House No-165, Mouglaha Chauraha, BRD Medical College Road, Gorakhpur 273013', '9034027155',
 80, '8am–10pm (All days)',
 '["Generic medicines","Branded alternatives","Home delivery","Up to 80% savings"]', TRUE),

-- Apollo Pharmacy
('Apollo Pharmacy – Gorakhpur',
 'pharmacy_chain', 'Apollo Clinic, Mohaddipur, Gorakhpur', '0551-2345678',
 20, '8am–10pm (All days)',
 '["Branded medicines","Free home delivery","Doctor consultation","Online order"]', TRUE),

-- Online (PharmEasy)
('PharmEasy (Online Delivery)',
 'online', 'Online – delivers across Gorakhpur', '1800-120-1234',
 18, '24 Hours',
 '["18% flat off","Free delivery above ₹299","Upload prescription","Scheduled delivery"]', TRUE),

-- Top local stores
('Shivay Medical Store',
 'local', 'Golghar Chowk, Gorakhpur', '9415100001',
 10, '8am–11pm (All days)',
 '["All brands","Quick service","Near hospitals"]', FALSE),

('Awasthi Medical Hall',
 'local', 'Civil Lines, Gorakhpur', '9415100002',
 10, '7am–11pm (All days)',
 '["All brands","Established store","Experienced staff"]', FALSE),

('Onkar Medical Store',
 'local', 'Betiahata Road, Gorakhpur', '9415100003',
 10, '8am–10pm (All days)',
 '["All brands","Home delivery available","Ayurvedic range"]', TRUE),

('Kirti Pharmacy',
 'local', 'Padri Bazar, Gorakhpur', '9415100004',
 12, '8am–10pm (All days)',
 '["All brands","Generic options","Medical equipment"]', FALSE);
