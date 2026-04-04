# Gorakhpur City Guide — Fun Planner & Healthcare

A full-stack web application for Gorakhpur residents and visitors to plan a day out within ₹1000 and find doctors/medicines at the best prices.

---

## Features

### v1 — Fun Planner
- Browse 24 activities across 6 categories: Food, Sightseeing, Entertainment, Shopping, Transport
- Dynamic budget tracker (₹1000 limit)
- 6 pre-built day itineraries (Family Day, Couple's Day, Kids Special, etc.)
- Save custom plans to the database

### v2 — Healthcare
- Find doctors by specialization (Cardiologist, Neurologist, Gynecologist, ENT, Dentist, etc.)
- Filter by Government (AIIMS OPD — ₹10–50) or Private clinics
- 12 medicine stores sorted by savings — Jan Aushadhi stores up to 90% cheaper
- Filter stores by type: Jan Aushadhi, Generic, Online, Chain, Local

---

## Tech Stack

| Layer     | Technology            |
|-----------|-----------------------|
| Frontend  | HTML, CSS, Vanilla JS |
| Backend   | Python 3.11 + Flask   |
| Database  | MySQL 8.0             |
| Server    | Nginx (Alpine)        |
| Container | Docker + Docker Compose |

---

## Project Structure

```
DevOps/
├── backend/
│   ├── app.py              # Flask REST API
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile          # Python 3.11-slim image
├── db/
│   ├── init.sql            # Schema + seed data (v1)
│   └── v2_healthcare.sql   # Doctors & medicine stores (v2)
├── nginx/
│   ├── Dockerfile          # Nginx image with frontend baked in
│   └── nginx.conf          # Static serve + /api/ proxy to backend
├── gorakhpur-enjoy/
│   └── index.html          # Frontend (Fun Planner + Healthcare tabs)
├── docker-compose.yml      # Orchestrates db, backend, frontend
└── .env.example            # Environment variable template
```

---

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Run the Application

```bash
# Clone the repository
git clone https://github.com/asingh5535/DevOps.git
cd DevOps

# (Optional) Copy and edit environment variables
cp .env.example .env

# Build and start all containers
docker compose up -d --build

# Verify all containers are running
docker compose ps
```

The app will be available at **http://localhost:8080**

---

## Access URLs

| Service         | URL                          |
|-----------------|------------------------------|
| Web App         | http://localhost:8080         |
| Flask API       | http://localhost:5000         |
| MySQL           | localhost:3306                |
| Local Network   | http://192.168.31.23:8080    |

---

## API Endpoints

### Activities
| Method | Endpoint                        | Description                        |
|--------|---------------------------------|------------------------------------|
| GET    | `/api/activities`               | List all activities                |
| GET    | `/api/activities?category=food` | Filter by category                 |
| POST   | `/api/activities`               | Create a new activity              |
| PUT    | `/api/activities/<id>`          | Update an activity                 |
| DELETE | `/api/activities/<id>`          | Delete an activity                 |

### Combos
| Method | Endpoint       | Description          |
|--------|----------------|----------------------|
| GET    | `/api/combos`  | List all day combos  |

### Saved Plans
| Method | Endpoint           | Description           |
|--------|--------------------|-----------------------|
| GET    | `/api/plans`       | List all saved plans  |
| POST   | `/api/plans`       | Save a plan           |
| DELETE | `/api/plans/<id>`  | Delete a saved plan   |

### Doctors (v2)
| Method | Endpoint                                        | Description                        |
|--------|-------------------------------------------------|------------------------------------|
| GET    | `/api/doctors`                                  | List all doctors                   |
| GET    | `/api/doctors?specialization=Cardiologist`      | Filter by specialization           |
| GET    | `/api/doctors?type=government`                  | Filter government/private          |
| GET    | `/api/doctors/specializations`                  | List all unique specializations    |

### Medicine Stores (v2)
| Method | Endpoint                                   | Description                        |
|--------|--------------------------------------------|------------------------------------|
| GET    | `/api/medicine-stores`                     | List all stores (cheapest first)   |
| GET    | `/api/medicine-stores?type=jan_aushadhi`   | Filter by store type               |

### Health Check
| Method | Endpoint       | Description      |
|--------|----------------|------------------|
| GET    | `/api/health`  | Backend status   |

---

## Database

### Tables

| Table            | Rows | Description                        |
|------------------|------|------------------------------------|
| `activities`     | 24   | Day-out activities with costs      |
| `combos`         | 6    | Pre-built itinerary combinations   |
| `saved_plans`    | —    | User-saved plans                   |
| `doctors`        | 29   | Doctors with specialization & fees |
| `medicine_stores`| 12   | Pharmacies sorted by savings       |

### Connect to MySQL

```bash
winpty docker exec -it gorakhpur_db mysql -u gorakhpur -pgorakhpur123 gorakhpur_planner
```

### Sample Queries

```sql
-- All activities by category
SELECT name, cost FROM activities WHERE category = 'food';

-- Government doctors only
SELECT name, specialization, fee_min, fee_max FROM doctors WHERE type = 'government';

-- Cheapest medicine stores
SELECT name, type, savings_percent FROM medicine_stores ORDER BY savings_percent DESC;

-- All saved plans
SELECT * FROM saved_plans ORDER BY created_at DESC;
```

---

## Docker Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Rebuild after code changes
docker compose build
docker compose up -d

# Rebuild a specific service
docker compose build backend
docker compose up -d --no-deps backend

# View live logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
```

---

## Environment Variables

Copy `.env.example` to `.env` and update values:

```env
MYSQL_ROOT_PASSWORD=root123
MYSQL_DATABASE=gorakhpur_planner
MYSQL_USER=gorakhpur
MYSQL_PASSWORD=gorakhpur123
```

---

## Make it Public (Temporary URL)

Requires Node.js installed:

```bash
npx localtunnel --port 8080 --subdomain gorakhpur-guide
# Opens: https://gorakhpur-guide.loca.lt
```

---

## Data Sources

- Doctors: [Fatima Hospital Gorakhpur](https://www.fatimahospitalgkp.com/DoctorsList), [AIIMS Gorakhpur](https://aiimsgorakhpur.edu.in), [Practo](https://www.practo.com/gorakhpur/doctors)
- Medicine Stores: [Jan Aushadhi Kendras](https://www.genericdrugscan.com/jan-aushadhi-stores/uttar-pradesh/gorakhpur), [Zeelab Pharmacy](https://zeelabpharmacy.com/store-locator/uttar-pradesh/gorakhpur), [Apollo Gorakhpur](https://www.apollogorakhpur.com)

---

## Author

**Abhishek Singh**  
GitHub: [@asingh5535](https://github.com/asingh5535)
