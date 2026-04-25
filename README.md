# DevOps Projects — Abhishek Singh

Full-stack containerized applications covering Python/Flask, Node.js, React, MySQL, PostgreSQL, Redis, and Docker infrastructure.

---

## Projects Overview

| # | Project | Port | Stack | Description |
|---|---------|------|-------|-------------|
| 1 | **Gorakhpur City Guide** | `8080` | Python + MySQL + Nginx | Fun planner + Healthcare finder |
| 2 | **NetStream** | `8090` | Python + MySQL + Nginx | Netflix-like movie streaming app |
| 3 | **Brahma** | `3000` | Node.js + React + PostgreSQL + Redis | Twitter-like social platform |

---

## Project 1 — Gorakhpur City Guide

**Folder:** `DevOps/` (root `docker-compose.yml`)

### Features
- **Fun Planner (v1)** — 24 activities, ₹1000 budget tracker, 6 day-combo plans, save plans to DB
- **Healthcare (v2)** — 29 doctors by specialization, 12 medicine stores sorted cheapest first (Jan Aushadhi up to 90% off)

### Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Python 3.11 + Flask |
| Database | MySQL 8.0 |
| Server | Nginx (Alpine) |
| Infra | Docker + Docker Compose |

### Run
```bash
cd DevOps
docker compose up -d --build
```

### Access
| Service | URL |
|---------|-----|
| Web App | http://localhost:8080 |
| API | http://localhost:5000 |

### API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/activities` | List activities |
| GET | `/api/combos` | Day combo plans |
| GET/POST | `/api/plans` | Saved plans |
| GET | `/api/doctors` | Doctors (v2) |
| GET | `/api/medicine-stores` | Medicine stores (v2) |

---

## Project 2 — NetStream (Netflix Clone)

**Folder:** `DevOps/netflix-clone/`

### Features
- User auth (register / login with JWT + bcrypt)
- Browse 20 movies across 9 genres
- Netflix-style UI: hero banner, genre rows, hover cards
- Full-screen video player with resume support
- 1–10 star rating system with live average
- Reviews, Watchlist, Watch history, Search

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
cd DevOps/netflix-clone
docker compose up -d --build
```

### Access
| Service | URL |
|---------|-----|
| Web App | http://localhost:8090 |
| API | http://localhost:5001 |

### Demo Login
| Field | Value |
|-------|-------|
| Email | `netflix@demo.com` |
| Password | `netflix123` |

### Key API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/movies` | All movies |
| GET | `/api/movies/by-genre` | Movies grouped by genre |
| POST | `/api/movies/<id>/rate` | Rate a movie (1–10) |
| GET/POST | `/api/movies/<id>/reviews` | Reviews |
| GET/POST/DELETE | `/api/watchlist` | Watchlist |
| GET/POST | `/api/history/<id>` | Watch history & progress |

---

## Project 3 — Brahma (Twitter Clone)

**Folder:** `DevOps/brahma/`

### Features
- JWT auth — register, login, persistent sessions
- Tweet, reply, retweet, like, bookmark (up to 280 characters)
- Hashtag auto-extraction, clickable hashtags, trending sidebar
- Personalised timeline (Redis-cached, 60s TTL)
- Full-text tweet search (PostgreSQL)
- Real-time notifications via Socket.io (likes, retweets, follows, replies)
- Direct messages with conversation list
- User profiles with follow/unfollow, bio editing
- "Who to follow" suggestions
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
cd DevOps/brahma
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
| GET/POST | `/api/messages/:userId` | Direct messages |

---

## Run All Projects

Each project runs on separate ports and can run simultaneously.

```bash
# Project 1 — Gorakhpur City Guide (port 8080)
cd DevOps && docker compose up -d

# Project 2 — NetStream (port 8090)
cd DevOps/netflix-clone && docker compose up -d

# Project 3 — Brahma Twitter Clone (port 3000)
cd DevOps/brahma && docker compose up -d
```

### Port Summary
| Project | App Port | DB Port |
|---------|----------|---------|
| Gorakhpur City Guide | 8080 | 3306 |
| NetStream | 8090 | 3307 |
| Brahma | 3000 | 5433 |

---

## Repo Structure

```
DevOps/
├── backend/              # Gorakhpur Flask API
├── db/                   # Gorakhpur MySQL init scripts
├── nginx/                # Gorakhpur Nginx config
├── gorakhpur-enjoy/      # Gorakhpur frontend SPA
├── netflix-clone/        # Project 2 — NetStream
│   ├── backend/
│   ├── frontend/
│   ├── db/
│   └── docker-compose.yml
├── brahma/               # Project 3 — Brahma (Twitter clone)
│   ├── backend/          # Node.js + Express API
│   ├── frontend/         # React 18 + Vite SPA
│   ├── db/init.sql       # PostgreSQL schema + seed data
│   └── docker-compose.yml
├── docker-compose.yml    # Gorakhpur orchestration
└── README.md
```

---

## Author

**Abhishek Singh**
GitHub: [@asingh5535](https://github.com/asingh5535)
