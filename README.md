# DevOps Projects — Abhishek Singh

Three full-stack containerized applications, each with Python backend, MySQL database, and Docker infrastructure.

---

## Projects Overview

| # | Project | Port | Description |
|---|---------|------|-------------|
| 1 | **Gorakhpur City Guide** | `8080` | Fun planner + Healthcare finder (v1 + v2) |
| 2 | **Healthcare v2** | — | Built into Project 1 as a tab |
| 3 | **NetStream** | `8090` | Netflix-like movie streaming app |

---

## Project 1 & 2 — Gorakhpur City Guide

**Folder:** `gorakhpur-enjoy/`, `backend/`, `db/`, `nginx/`

### Features
- **v1 Fun Planner** — 24 activities, ₹1000 budget tracker, 6 day-combo plans, save plans to DB
- **v2 Healthcare** — 29 doctors by specialization, 12 medicine stores sorted cheapest first (Jan Aushadhi up to 90% off)

### Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | HTML, CSS, Vanilla JS (baked into nginx image) |
| Backend | Python 3.11 + Flask |
| Database | MySQL 8.0 |
| Server | Nginx (Alpine) |
| Infra | Docker + Docker Compose |

### Run
```bash
docker compose up -d --build
```

### Access
| Service | URL |
|---------|-----|
| Web App | http://localhost:8080 |
| API | http://localhost:5000 |
| MySQL | localhost:3306 |

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/activities?category=food` | List activities |
| POST | `/api/activities` | Add activity |
| GET | `/api/combos` | Day combo plans |
| GET/POST | `/api/plans` | Saved plans |
| GET | `/api/doctors?specialization=Cardiologist` | Doctors (v2) |
| GET | `/api/doctors/specializations` | All specializations |
| GET | `/api/medicine-stores?type=jan_aushadhi` | Medicine stores (v2) |

### Database Tables
| Table | Rows | Description |
|-------|------|-------------|
| `activities` | 24 | Day-out activities |
| `combos` | 6 | Pre-built itineraries |
| `saved_plans` | — | User-saved plans |
| `doctors` | 29 | Gorakhpur doctors with fees |
| `medicine_stores` | 12 | Pharmacies sorted by savings |

### Connect to MySQL
```bash
winpty docker exec -it gorakhpur_db mysql -u gorakhpur -pgorakhpur123 gorakhpur_planner
```

---

## Project 3 — NetStream (Netflix Clone)

**Folder:** `netflix-clone/`

### Features
- User auth (register / login with JWT + bcrypt)
- Browse 20 movies across 9 genres
- Netflix-style UI: hero banner, genre rows, hover cards
- Full-screen video player with resume support
- 1–10 star rating system (live average update)
- Reviews — post and delete your own
- Watchlist — My List page
- Watch history — "Continue Watching" row
- Search by title

### Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | HTML, CSS, Vanilla JS SPA |
| Backend | Python 3.11 + Flask + PyJWT + bcrypt |
| Database | MySQL 8.0 |
| Server | Nginx (Alpine) |
| Infra | Docker + Docker Compose |

### Run
```bash
cd netflix-clone
docker compose up -d --build
```

### Access
| Service | URL |
|---------|-----|
| Web App | http://localhost:8090 |
| API | http://localhost:5001 |
| MySQL | localhost:3307 |

### Demo Login
| Field | Value |
|-------|-------|
| Email | `netflix@demo.com` |
| Password | `netflix123` |

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/movies` | All movies (`?search=`, `?genre_id=`) |
| GET | `/api/movies/featured` | Hero banner movies |
| GET | `/api/movies/trending` | Trending movies |
| GET | `/api/movies/by-genre` | Movies grouped by genre |
| GET | `/api/movies/<id>` | Movie detail |
| POST | `/api/movies/<id>/rate` | Rate a movie (1–10) |
| GET/POST | `/api/movies/<id>/reviews` | Get / add reviews |
| DELETE | `/api/reviews/<id>` | Delete own review |
| GET/POST/DELETE | `/api/watchlist` | Watchlist management |
| GET/POST/DELETE | `/api/history/<id>` | Watch history & progress |

### Database Tables
| Table | Rows | Description |
|-------|------|-------------|
| `users` | — | Registered users |
| `movies` | 20 | Movies with video URLs |
| `genres` | 9 | Action, Drama, Comedy… |
| `ratings` | — | User ratings (1–10) |
| `reviews` | — | User text reviews |
| `watchlist` | — | Per-user watchlists |
| `watch_history` | — | Progress tracking |

### Connect to MySQL
```bash
winpty docker exec -it netflix_db mysql -u netflix -pnetflix123 netflix
```

---

## Full Repo Structure

```
DevOps/
├── backend/                    # Gorakhpur Flask API
│   ├── app.py
│   ├── requirements.txt
│   └── Dockerfile
├── db/                         # Gorakhpur MySQL
│   ├── init.sql                # v1 schema + seed
│   └── v2_healthcare.sql       # doctors + medicine stores
├── nginx/                      # Gorakhpur nginx
│   ├── Dockerfile
│   └── nginx.conf
├── gorakhpur-enjoy/
│   └── index.html              # Gorakhpur frontend
├── netflix-clone/              # Netflix clone (Project 3)
│   ├── backend/
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── frontend/
│   │   ├── index.html
│   │   ├── nginx.conf
│   │   └── Dockerfile
│   ├── db/
│   │   └── init.sql
│   └── docker-compose.yml
├── docker-compose.yml          # Gorakhpur orchestration
└── README.md
```

---

## Run All Projects Together

```bash
# Project 1 & 2 — Gorakhpur City Guide
cd C:/Users/lenovo/Downloads/abhishekgitclonerepo/DevOps
docker compose up -d

# Project 3 — NetStream
cd C:/Users/lenovo/Downloads/abhishekgitclonerepo/DevOps/netflix-clone
docker compose up -d
```

---

## Author

**Abhishek Singh**
GitHub: [@asingh5535](https://github.com/asingh5535)
