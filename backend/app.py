import json
import time
import os

import mysql.connector
from mysql.connector import Error
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "db"),
    "user": os.getenv("DB_USER", "gorakhpur"),
    "password": os.getenv("DB_PASSWORD", "gorakhpur123"),
    "database": os.getenv("DB_NAME", "gorakhpur_planner"),
}


def get_db():
    """Return a new DB connection, retrying up to 10 times on startup."""
    for attempt in range(10):
        try:
            return mysql.connector.connect(**DB_CONFIG)
        except Error:
            if attempt == 9:
                raise
            time.sleep(3)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------

@app.route("/api/activities")
def get_activities():
    category = request.args.get("category")
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    if category and category != "all":
        cursor.execute(
            "SELECT * FROM activities WHERE category = %s ORDER BY id", (category,)
        )
    else:
        cursor.execute("SELECT * FROM activities ORDER BY id")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for row in rows:
        if isinstance(row.get("tags"), str):
            row["tags"] = json.loads(row["tags"])
    return jsonify(rows)


@app.route("/api/activities", methods=["POST"])
def create_activity():
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO activities (name, emoji, category, cost, description, tags) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (
            data["name"],
            data.get("emoji", ""),
            data["category"],
            data.get("cost", 0),
            data.get("description", ""),
            json.dumps(data.get("tags", [])),
        ),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return jsonify({"id": new_id, **data}), 201


@app.route("/api/activities/<int:activity_id>", methods=["PUT"])
def update_activity(activity_id):
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE activities SET name=%s, emoji=%s, category=%s, cost=%s, "
        "description=%s, tags=%s WHERE id=%s",
        (
            data["name"],
            data.get("emoji", ""),
            data["category"],
            data.get("cost", 0),
            data.get("description", ""),
            json.dumps(data.get("tags", [])),
            activity_id,
        ),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"id": activity_id, **data})


@app.route("/api/activities/<int:activity_id>", methods=["DELETE"])
def delete_activity(activity_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM activities WHERE id = %s", (activity_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"deleted": activity_id})


# ---------------------------------------------------------------------------
# Combos
# ---------------------------------------------------------------------------

@app.route("/api/combos")
def get_combos():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM combos ORDER BY id")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for row in rows:
        if isinstance(row.get("activity_ids"), str):
            row["activity_ids"] = json.loads(row["activity_ids"])
    return jsonify(rows)


# ---------------------------------------------------------------------------
# Saved Plans
# ---------------------------------------------------------------------------

@app.route("/api/plans")
def get_plans():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM saved_plans ORDER BY created_at DESC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for row in rows:
        if isinstance(row.get("activity_ids"), str):
            row["activity_ids"] = json.loads(row["activity_ids"])
        if row.get("created_at"):
            row["created_at"] = row["created_at"].isoformat()
    return jsonify(rows)


@app.route("/api/plans", methods=["POST"])
def save_plan():
    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO saved_plans (name, activity_ids, total_cost) VALUES (%s, %s, %s)",
        (
            data.get("name", "My Plan"),
            json.dumps(data.get("activity_ids", [])),
            data.get("total_cost", 0),
        ),
    )
    conn.commit()
    new_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return jsonify({"id": new_id, **data}), 201


@app.route("/api/plans/<int:plan_id>", methods=["DELETE"])
def delete_plan(plan_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM saved_plans WHERE id = %s", (plan_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({"deleted": plan_id})


# ---------------------------------------------------------------------------
# V2 — Doctors
# ---------------------------------------------------------------------------

@app.route("/api/doctors")
def get_doctors():
    specialization = request.args.get("specialization")
    doc_type = request.args.get("type")  # government / private
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM doctors WHERE 1=1"
    params = []
    if specialization and specialization != "all":
        query += " AND specialization = %s"
        params.append(specialization)
    if doc_type and doc_type != "all":
        query += " AND type = %s"
        params.append(doc_type)
    query += " ORDER BY type DESC, fee_min ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(rows)


@app.route("/api/doctors/specializations")
def get_specializations():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT specialization FROM doctors ORDER BY specialization")
    rows = [r[0] for r in cursor.fetchall()]
    cursor.close()
    conn.close()
    return jsonify(rows)


# ---------------------------------------------------------------------------
# V2 — Medicine Stores
# ---------------------------------------------------------------------------

@app.route("/api/medicine-stores")
def get_medicine_stores():
    store_type = request.args.get("type")
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    if store_type and store_type != "all":
        cursor.execute(
            "SELECT * FROM medicine_stores WHERE type = %s ORDER BY savings_percent DESC", (store_type,)
        )
    else:
        cursor.execute("SELECT * FROM medicine_stores ORDER BY savings_percent DESC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    for row in rows:
        if isinstance(row.get("features"), str):
            row["features"] = json.loads(row["features"])
        row["delivers"] = bool(row["delivers"])
    return jsonify(rows)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
