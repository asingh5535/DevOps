import json
import os
import time
from datetime import datetime, timezone, timedelta
from functools import wraps

import bcrypt
import jwt
import mysql.connector
from mysql.connector import Error
from flask import Flask, jsonify, request, g
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_jwt_key_change_in_prod")

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "db"),
    "user": os.getenv("DB_USER", "netflix"),
    "password": os.getenv("DB_PASSWORD", "netflix123"),
    "database": os.getenv("DB_NAME", "netflix"),
}


def get_db():
    for attempt in range(10):
        try:
            return mysql.connector.connect(**DB_CONFIG)
        except Error:
            if attempt == 9:
                raise
            time.sleep(3)


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        token = auth.replace("Bearer ", "").strip()
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            g.user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def _serialize(row):
    """Convert datetime/Decimal fields for JSON serialization."""
    if row is None:
        return None
    for k, v in row.items():
        if hasattr(v, "isoformat"):
            row[k] = v.isoformat()
        elif hasattr(v, "__float__"):
            row[k] = float(v)
    return row


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
            (username, email, pw_hash),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except mysql.connector.IntegrityError as e:
        cursor.close()
        conn.close()
        msg = "Email already registered" if "email" in str(e) else "Username already taken"
        return jsonify({"error": msg}), 409
    finally:
        cursor.close()
        conn.close()

    token = jwt.encode(
        {"user_id": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        SECRET_KEY, algorithm="HS256",
    )
    return jsonify({
        "token": token,
        "user": {"id": user_id, "username": username, "email": email, "avatar_color": "#E50914"},
    }), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return jsonify({"error": "Invalid email or password"}), 401

    token = jwt.encode(
        {"user_id": user["id"], "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        SECRET_KEY, algorithm="HS256",
    )
    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "avatar_color": user["avatar_color"],
        },
    })


@app.route("/api/auth/me")
@require_auth
def me():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, username, email, avatar_color, created_at FROM users WHERE id = %s",
        (g.user_id,),
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    return jsonify(_serialize(user))


# ---------------------------------------------------------------------------
# Genres
# ---------------------------------------------------------------------------

@app.route("/api/genres")
def get_genres():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM genres ORDER BY name")
    genres = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(genres)


# ---------------------------------------------------------------------------
# Movies
# ---------------------------------------------------------------------------

def _movie_query(where="", params=(), order="m.watch_count DESC", limit=None):
    sql = (
        "SELECT m.*, g.name AS genre_name, "
        "COALESCE((SELECT AVG(score) FROM ratings WHERE movie_id = m.id), 0) AS avg_rating, "
        "COALESCE((SELECT COUNT(*) FROM ratings WHERE movie_id = m.id), 0) AS rating_count "
        "FROM movies m LEFT JOIN genres g ON m.genre_id = g.id "
    )
    if where:
        sql += f" WHERE {where}"
    sql += f" ORDER BY {order}"
    if limit:
        sql += f" LIMIT {int(limit)}"
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [_serialize(r) for r in rows]


@app.route("/api/movies")
def get_movies():
    search = request.args.get("search", "").strip()
    genre_id = request.args.get("genre_id")
    if search:
        rows = _movie_query("m.title LIKE %s", (f"%{search}%",), "m.rating_avg DESC")
    elif genre_id:
        rows = _movie_query("m.genre_id = %s", (genre_id,), "m.rating_avg DESC")
    else:
        rows = _movie_query(order="m.watch_count DESC")
    return jsonify(rows)


@app.route("/api/movies/featured")
def featured():
    rows = _movie_query("m.is_featured = 1", order="m.watch_count DESC", limit=3)
    return jsonify(rows)


@app.route("/api/movies/trending")
def trending():
    rows = _movie_query(order="(m.rating_avg * 2 + m.watch_count * 0.05) DESC", limit=12)
    return jsonify(rows)


@app.route("/api/movies/by-genre")
def by_genre():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM genres ORDER BY name")
    genres = cursor.fetchall()
    cursor.close()
    conn.close()

    result = []
    for g_row in genres:
        movies = _movie_query(
            "m.genre_id = %s", (g_row["id"],), "m.rating_avg DESC", limit=10
        )
        if movies:
            result.append({"genre_id": g_row["id"], "genre_name": g_row["name"], "movies": movies})
    return jsonify(result)


@app.route("/api/movies/<int:movie_id>")
def get_movie(movie_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT m.*, g.name AS genre_name FROM movies m "
        "LEFT JOIN genres g ON m.genre_id = g.id WHERE m.id = %s",
        (movie_id,),
    )
    movie = cursor.fetchone()
    if not movie:
        cursor.close()
        conn.close()
        return jsonify({"error": "Movie not found"}), 404

    cursor.execute("UPDATE movies SET watch_count = watch_count + 1 WHERE id = %s", (movie_id,))
    cursor.execute(
        "SELECT COALESCE(AVG(score), 0) AS avg_rating, COUNT(*) AS rating_count "
        "FROM ratings WHERE movie_id = %s",
        (movie_id,),
    )
    stats = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()

    movie = _serialize(movie)
    movie["avg_rating"] = float(stats["avg_rating"])
    movie["rating_count"] = stats["rating_count"]
    return jsonify(movie)


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------

@app.route("/api/movies/<int:movie_id>/rate", methods=["POST"])
@require_auth
def rate_movie(movie_id):
    data = request.get_json() or {}
    score = data.get("score")
    if not isinstance(score, int) or not (1 <= score <= 10):
        return jsonify({"error": "Score must be an integer between 1 and 10"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO ratings (user_id, movie_id, score) VALUES (%s, %s, %s) "
        "ON DUPLICATE KEY UPDATE score = VALUES(score)",
        (g.user_id, movie_id, score),
    )
    cursor.execute(
        "UPDATE movies SET "
        "rating_avg   = (SELECT AVG(score)   FROM ratings WHERE movie_id = %s), "
        "rating_count = (SELECT COUNT(*)      FROM ratings WHERE movie_id = %s) "
        "WHERE id = %s",
        (movie_id, movie_id, movie_id),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"score": score})


@app.route("/api/movies/<int:movie_id>/my-rating")
@require_auth
def my_rating(movie_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT score FROM ratings WHERE user_id = %s AND movie_id = %s",
        (g.user_id, movie_id),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return jsonify({"score": row["score"] if row else None})


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------

@app.route("/api/movies/<int:movie_id>/reviews")
def get_reviews(movie_id):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT r.id, r.body, r.created_at, u.username, u.avatar_color "
        "FROM reviews r JOIN users u ON r.user_id = u.id "
        "WHERE r.movie_id = %s ORDER BY r.created_at DESC",
        (movie_id,),
    )
    reviews = [_serialize(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify(reviews)


@app.route("/api/movies/<int:movie_id>/reviews", methods=["POST"])
@require_auth
def add_review(movie_id):
    data = request.get_json() or {}
    body = data.get("body", "").strip()
    if not body:
        return jsonify({"error": "Review body required"}), 400
    if len(body) > 1000:
        return jsonify({"error": "Review too long (max 1000 characters)"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO reviews (user_id, movie_id, body) VALUES (%s, %s, %s)",
        (g.user_id, movie_id, body),
    )
    conn.commit()
    review_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return jsonify({"id": review_id, "body": body}), 201


@app.route("/api/reviews/<int:review_id>", methods=["DELETE"])
@require_auth
def delete_review(review_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM reviews WHERE id = %s AND user_id = %s",
        (review_id, g.user_id),
    )
    conn.commit()
    deleted = cursor.rowcount
    cursor.close()
    conn.close()
    if not deleted:
        return jsonify({"error": "Review not found or not yours"}), 404
    return jsonify({"deleted": review_id})


# ---------------------------------------------------------------------------
# Watchlist
# ---------------------------------------------------------------------------

@app.route("/api/watchlist")
@require_auth
def get_watchlist():
    rows = []
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT m.*, g.name AS genre_name FROM movies m "
        "JOIN watchlist wl ON m.id = wl.movie_id "
        "LEFT JOIN genres g ON m.genre_id = g.id "
        "WHERE wl.user_id = %s ORDER BY wl.added_at DESC",
        (g.user_id,),
    )
    rows = [_serialize(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify(rows)


@app.route("/api/watchlist/<int:movie_id>", methods=["POST"])
@require_auth
def add_watchlist(movie_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO watchlist (user_id, movie_id) VALUES (%s, %s)",
            (g.user_id, movie_id),
        )
        conn.commit()
    except mysql.connector.IntegrityError:
        pass
    finally:
        cursor.close()
        conn.close()
    return jsonify({"added": True})


@app.route("/api/watchlist/<int:movie_id>", methods=["DELETE"])
@require_auth
def remove_watchlist(movie_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM watchlist WHERE user_id = %s AND movie_id = %s",
        (g.user_id, movie_id),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"removed": True})


@app.route("/api/watchlist/ids")
@require_auth
def watchlist_ids():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT movie_id FROM watchlist WHERE user_id = %s", (g.user_id,))
    ids = [r[0] for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify(ids)


# ---------------------------------------------------------------------------
# Watch History
# ---------------------------------------------------------------------------

@app.route("/api/history")
@require_auth
def get_history():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT m.*, g.name AS genre_name, wh.progress_sec, wh.completed, wh.last_watched "
        "FROM movies m "
        "JOIN watch_history wh ON m.id = wh.movie_id "
        "LEFT JOIN genres g ON m.genre_id = g.id "
        "WHERE wh.user_id = %s ORDER BY wh.last_watched DESC",
        (g.user_id,),
    )
    rows = [_serialize(r) for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify(rows)


@app.route("/api/history/<int:movie_id>", methods=["POST"])
@require_auth
def save_history(movie_id):
    data = request.get_json() or {}
    progress = int(data.get("progress_sec", 0))
    completed = 1 if data.get("completed") else 0
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO watch_history (user_id, movie_id, progress_sec, completed) "
        "VALUES (%s, %s, %s, %s) "
        "ON DUPLICATE KEY UPDATE progress_sec = VALUES(progress_sec), "
        "completed = VALUES(completed), last_watched = CURRENT_TIMESTAMP",
        (g.user_id, movie_id, progress, completed),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"saved": True})


@app.route("/api/history/<int:movie_id>", methods=["DELETE"])
@require_auth
def delete_history(movie_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM watch_history WHERE user_id = %s AND movie_id = %s",
        (g.user_id, movie_id),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"removed": True})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
