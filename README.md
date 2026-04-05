# DevOps Projects — Abhishek Singh

Four full-stack containerized applications covering Python/Flask, Node.js, MySQL, PostgreSQL, Redis, and Docker infrastructure.

---

## Projects Overview

| # | Project | Port | Stack | Description |
|---|---------|------|-------|-------------|
| 1 | **Gorakhpur City Guide** | `8080` | Python + MySQL | Fun planner + Healthcare finder (v1 + v2) |
| 2 | **Healthcare v2** | — | Built into Project 1 | Doctors & pharmacies tab |
| 3 | **NetStream** | `8090` | Python + MySQL | Netflix-like movie streaming app |
| 4 | **Brahma** | `3000` | Node.js + PostgreSQL + Redis | Twitter-like social platform |

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

## Project 4 — Brahma (Twitter Clone)

**Folder:** `brahma/`

### Features
- JWT auth — register, login, persistent sessions
- Tweet, reply, retweet, like, bookmark (up to 280 characters)
- Hashtag auto-extraction, clickable hashtags, trending sidebar
- Personalised timeline (Redis-cached, 60 s TTL)
- Full-text tweet search (PostgreSQL)
- Real-time notifications via Socket.io (likes, retweets, follows, replies)
- Direct messages with conversation list
- User profiles with follow/unfollow, bio editing
- "Who to follow" suggestions
- Trending hashtags (Redis-cached, 5 min TTL)
- Three-column Twitter dark-mode UI

### Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + React Router v6 |
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Real-time | Socket.io 4 |
| Auth | JWT + bcryptjs |
| Server | Nginx (multi-stage Docker build) |
| Infra | Docker + Docker Compose |

### Run
```bash
cd brahma
docker compose up -d --build
```

### Access
| Service | URL / Port |
|---------|-----------|
| Web App | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6380 |

### Demo Accounts (password: `brahma123`)
| Name | Handle | Email |
|------|--------|-------|
| Brahma Admin | @brahma | brahma@demo.com |
| Abhishek Singh | @abhishek | abhishek@demo.com |
| Priya Sharma | @priyasharma | priya@demo.com |
| Rahul Gupta | @rahulgupta | rahul@demo.com |
| Neha Verma | @nehaverma | neha@demo.com |

### Key API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/tweets/timeline` | Personalised feed |
| POST | `/api/tweets` | Post a tweet |
| POST | `/api/tweets/:id/like` | Like a tweet |
| POST | `/api/tweets/:id/retweet` | Retweet |
| GET | `/api/users/:handle` | User profile |
| POST | `/api/users/:id/follow` | Follow user |
| GET | `/api/search?q=` | Full-text search |
| GET | `/api/trending` | Trending hashtags |
| GET | `/api/messages/conversations` | DM list |
| POST | `/api/messages/:userId` | Send DM |

### Connect to PostgreSQL
```bash
docker exec -it brahma_db psql -U brahma -d brahma
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
│   ├── init.sql
│   └── v2_healthcare.sql
├── nginx/                      # Gorakhpur nginx
│   ├── Dockerfile
│   └── nginx.conf
├── gorakhpur-enjoy/
│   └── index.html              # Gorakhpur frontend SPA
├── netflix-clone/              # Project 3 — NetStream
│   ├── backend/
│   ├── frontend/
│   ├── db/
│   └── docker-compose.yml
├── brahma/                     # Project 4 — Brahma (Twitter clone)
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── app.js
│   │       ├── db.js
│   │       ├── redis.js
│   │       ├── middleware/auth.js
│   │       └── routes/         # auth, tweets, users, notifications,
│   │                           # messages, search, trending
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── nginx.conf
│   │   ├── vite.config.js
│   │   └── src/
│   │       ├── App.jsx
│   │       ├── api.js
│   │       ├── index.css
│   │       ├── context/AuthContext.jsx
│   │       ├── components/     # Layout, Sidebar, RightSidebar,
│   │       │                   # TweetCard, TweetComposer
│   │       └── pages/          # Auth, Home, Explore, Notifications,
│   │                           # Profile, Bookmarks, Messages
│   ├── db/init.sql             # PostgreSQL schema + seed data
│   ├── docker-compose.yml
│   ├── .env.example
│   └── README.md
├── docker-compose.yml          # Gorakhpur orchestration
└── README.md
```

---

## Run All Projects

Each project has its own Docker Compose file and runs on separate ports — they can all run simultaneously.

```bash
# Project 1 & 2 — Gorakhpur City Guide (port 8080)
cd DevOps
docker compose up -d

# Project 3 — NetStream (port 8090)
cd DevOps/netflix-clone
docker compose up -d

# Project 4 — Brahma (port 3000)
cd DevOps/brahma
docker compose up -d
```

### Port Summary
| Project | App Port | DB Port |
|---------|----------|---------|
| Gorakhpur | 8080 | 3306 |
| NetStream | 8090 | 3307 |
| Brahma | 3000 | 5433 |

---

## Author

**Abhishek Singh**
GitHub: [@asingh5535](https://github.com/asingh5535)
