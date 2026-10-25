# Brahma — Twitter-like Social Platform

A full-stack Twitter clone built with React, Node.js, PostgreSQL, Redis, and Socket.io — fully containerised with Docker Compose.

---

## Features

| Category | Details |
|---|---|
| **Auth** | JWT-based register / login, 30-day tokens, bcrypt password hashing |
| **Tweets** | Post, delete, reply, retweet, like, bookmark — up to 280 characters |
| **Hashtags** | Auto-extracted from tweet content, clickable, trending sidebar |
| **Timeline** | Personalised feed (followed users + own tweets), Redis-cached for 60 s |
| **Explore** | PostgreSQL full-text search across tweets |
| **Notifications** | Real-time via Socket.io — likes, retweets, follows, replies, mentions |
| **Direct Messages** | Private 1-to-1 messaging with conversation list |
| **Profiles** | Bio, avatar, follow/unfollow, follower / following counts |
| **Who to Follow** | Suggestions sidebar — top users not yet followed |
| **Trending** | Top hashtags by tweet count, Redis-cached for 5 min |

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Real-time | Socket.io 4 |
| Auth | JSON Web Tokens (jsonwebtoken) + bcryptjs |
| ORM/Query | pg (node-postgres) — raw SQL |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Bundler | Vite 5 |
| Routing | React Router v6 |
| HTTP | Axios (with Bearer token interceptor) |
| Real-time | socket.io-client |
| Styling | Pure CSS — Twitter dark theme |

### Infrastructure
| Service | Image | Host Port |
|---|---|---|
| PostgreSQL | postgres:16-alpine | 5433 |
| Redis | redis:7-alpine | 6380 |
| Backend API | Node.js (custom image) | 4000 |
| Frontend | Nginx + React build | **3000** |

---

## Project Structure

```
brahma/
├── docker-compose.yml          # Orchestrates all 4 services
├── .env.example                # Environment variable template
│
├── db/
│   └── init.sql                # PostgreSQL schema + seed data
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app.js              # Express + Socket.io server entry
│       ├── db.js               # pg connection pool
│       ├── redis.js            # ioredis client
│       ├── middleware/
│       │   └── auth.js         # JWT verify middleware
│       └── routes/
│           ├── auth.js         # /api/auth — register, login, me
│           ├── tweets.js       # /api/tweets — CRUD, like, retweet, bookmark
│           ├── users.js        # /api/users — profiles, follow, suggestions
│           ├── notifications.js# /api/notifications
│           ├── messages.js     # /api/messages — DMs
│           ├── search.js       # /api/search — full-text search
│           └── trending.js     # /api/trending — hashtag counts
│
└── frontend/
    ├── Dockerfile              # Multi-stage: node build → nginx serve
    ├── nginx.conf              # Static files + /api proxy + WebSocket upgrade
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx             # Router + auth guard
        ├── api.js              # Axios instance with auth interceptor
        ├── index.css           # Full Twitter dark theme
        ├── context/
        │   └── AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx
        │   ├── Sidebar.jsx
        │   ├── RightSidebar.jsx
        │   ├── TweetCard.jsx
        │   └── TweetComposer.jsx
        └── pages/
            ├── AuthPage.jsx
            ├── HomePage.jsx
            ├── ExplorePage.jsx
            ├── NotificationsPage.jsx
            ├── ProfilePage.jsx
            ├── BookmarksPage.jsx
            └── MessagesPage.jsx
```

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Clone / navigate to the project

```bash
cd brahma
```

### 2. (Optional) Configure environment

```bash
cp .env.example .env
# Edit .env to change secrets for production
```

### 3. Build and start

```bash
docker compose up --build -d
```

First run downloads base images and builds the React app — takes ~2–3 minutes.

### 4. Open the app

```
http://localhost:3000
```

### 5. Stop

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers + delete database volume
```

---

## Demo Accounts

All pre-seeded accounts use the password **`brahma123`**.

| Name | Handle | Email | Verified |
|---|---|---|---|
| Brahma Admin | @brahma | brahma@demo.com | Yes |
| Abhishek Singh | @abhishek | abhishek@demo.com | Yes |
| Priya Sharma | @priyasharma | priya@demo.com | — |
| Rahul Gupta | @rahulgupta | rahul@demo.com | — |
| Neha Verma | @nehaverma | neha@demo.com | — |

---

## API Reference

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Create account |
| POST | `/login` | No | Login, returns JWT |
| GET | `/me` | Yes | Get current user |
| PUT | `/me` | Yes | Update profile |

### Tweets — `/api/tweets`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/timeline` | Yes | Personalised feed |
| GET | `/` | No | All tweets |
| POST | `/` | Yes | Create tweet |
| DELETE | `/:id` | Yes | Delete own tweet |
| POST | `/:id/like` | Yes | Like tweet |
| DELETE | `/:id/like` | Yes | Unlike tweet |
| POST | `/:id/retweet` | Yes | Retweet |
| DELETE | `/:id/retweet` | Yes | Undo retweet |
| POST | `/:id/bookmark` | Yes | Bookmark tweet |
| DELETE | `/:id/bookmark` | Yes | Remove bookmark |
| GET | `/:id/replies` | No | Replies to a tweet |
| GET | `/user/bookmarks` | Yes | My bookmarks |

### Users — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:handle` | No | Get profile |
| GET | `/:handle/tweets` | No | User's tweets |
| POST | `/:id/follow` | Yes | Follow user |
| DELETE | `/:id/follow` | Yes | Unfollow user |
| GET | `/:id/is-following` | Yes | Check follow status |
| GET | `/:handle/followers` | No | Follower list |
| GET | `/:handle/following` | No | Following list |
| GET | `/suggestions/who-to-follow` | Yes | Follow suggestions |
| PATCH | `/me` | Yes | Update bio / avatar |

### Other

| Method | Path | Description |
|---|---|---|
| GET | `/api/search?q=` | Full-text tweet search |
| GET | `/api/trending` | Top hashtags |
| GET | `/api/notifications` | My notifications |
| PUT | `/api/notifications/:id/read` | Mark as read |
| GET | `/api/messages/conversations` | DM conversation list |
| GET | `/api/messages/:userId` | Messages with a user |
| POST | `/api/messages/:userId` | Send a message |

---

## Database Schema

Key tables in PostgreSQL:

```
users            — id (UUID), username, handle, email, password_hash, bio, avatar_url, verified, followers_count, following_count
tweets           — id (UUID), user_id, content, reply_to, image_url, likes_count, retweets_count, created_at + FTS index
follows          — follower_id → following_id
likes            — user_id + tweet_id
retweets         — user_id + tweet_id
bookmarks        — user_id + tweet_id
hashtags         — tag, count
tweet_hashtags   — tweet_id + hashtag_id
notifications    — user_id, actor_id, type (like/retweet/follow/reply/mention), tweet_id, read
direct_messages  — sender_id, receiver_id, content, read, created_at
```

Full schema with seed data: [`db/init.sql`](db/init.sql)

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | brahma | Database name |
| `POSTGRES_USER` | brahma | DB username |
| `POSTGRES_PASSWORD` | brahma123 | DB password |
| `JWT_SECRET` | brahma_jwt_secret | Change this in production |
| `CLIENT_URL` | http://localhost:3000 | CORS origin |

---

## Real-time Architecture

Socket.io runs on the same port as the Express HTTP server (4000). The Nginx frontend proxy upgrades `/socket.io/` connections to WebSocket.

```
Browser  ──ws──►  Nginx :3000  ──ws──►  Node :4000
                  /socket.io/           Socket.io server
                                              │
                                    io.to(userId).emit(event)
```

Events emitted to connected clients:
- `new_message` — new DM received
- `notification` — new like / retweet / follow / reply

---

## Caching Strategy

| Data | Cache Key | TTL |
|---|---|---|
| User timeline | `timeline:<userId>` | 60 seconds |
| Trending hashtags | `trending` | 300 seconds (5 min) |

Cache is invalidated automatically on write (new tweet, new follow). Redis runs independently; if it's unavailable the app falls back to direct DB queries.
