// ============================================================
//  Study Planner – server.js
//  Express + mysql2 → XAMPP MySQL
//  Run:  npm install  then  npm start
// ============================================================

const express = require("express");
const mysql   = require("mysql2/promise");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));   // serve index.html

// ── DB pools ─────────────────────────────────────────────────
// First pool: no database selected (used only during init)
let pool = mysql.createPool({
  host     : "localhost",
  port     : 3306,
  user     : "root",
  password : "",
  waitForConnections : true,
  connectionLimit    : 10,
});

// ── Helper ───────────────────────────────────────────────────
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ── Auto-setup: create DB + tables, then switch pool ─────────
async function initDatabase() {
  console.log("🔧  Checking database...");

  // Create DB if missing
  await pool.execute("CREATE DATABASE IF NOT EXISTS study_planner");

  // Recreate pool with database selected so ALL connections use it
  await pool.end();
  pool = mysql.createPool({
    host     : "localhost",
    port     : 3306,
    user     : "root",
    password : "",
    database : "study_planner",
    waitForConnections : true,
    connectionLimit    : 10,
  });

  await query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      color      VARCHAR(7) NOT NULL DEFAULT '#6c63ff',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      subject_id   INT NOT NULL,
      title        VARCHAR(200) NOT NULL,
      description  TEXT,
      date         DATE NOT NULL,
      start_time   TIME NOT NULL,
      end_time     TIME NOT NULL,
      duration_min INT DEFAULT 0,
      status       VARCHAR(10) DEFAULT 'planned',
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      subject_id INT NOT NULL,
      session_id INT DEFAULT NULL,
      title      VARCHAR(200) NOT NULL,
      due_date   DATE DEFAULT NULL,
      priority   VARCHAR(10) DEFAULT 'medium',
      completed  TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS goals (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      subject_id   INT NOT NULL,
      title        VARCHAR(200) NOT NULL,
      target_hours DECIMAL(6,1) DEFAULT 0,
      logged_hours DECIMAL(6,1) DEFAULT 0,
      deadline     DATE DEFAULT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `);

  console.log("✅  Database ready (study_planner)");
}

// ============================================================
//  SUBJECTS
// ============================================================

// GET all subjects
app.get("/api/subjects", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM subjects ORDER BY name");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create subject
app.post("/api/subjects", async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const result = await query(
      "INSERT INTO subjects (name, color) VALUES (?, ?)",
      [name, color || "#6c63ff"]
    );
    res.status(201).json({ id: result.insertId, name, color });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE subject
app.delete("/api/subjects/:id", async (req, res) => {
  try {
    await query("DELETE FROM subjects WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
//  SESSIONS
// ============================================================

// GET all sessions (optionally filter by date range or subject)
app.get("/api/sessions", async (req, res) => {
  const { subject_id, from, to } = req.query;
  let sql    = `SELECT s.*, sub.name AS subject_name, sub.color AS subject_color
                FROM sessions s
                JOIN subjects sub ON s.subject_id = sub.id
                WHERE 1=1`;
  const params = [];
  if (subject_id) { sql += " AND s.subject_id = ?"; params.push(subject_id); }
  if (from)       { sql += " AND s.date >= ?";       params.push(from); }
  if (to)         { sql += " AND s.date <= ?";        params.push(to); }
  sql += " ORDER BY s.date, s.start_time";
  try {
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create session
app.post("/api/sessions", async (req, res) => {
  const { subject_id, title, description, date, start_time, end_time } = req.body;
  if (!subject_id || !title || !date || !start_time || !end_time)
    return res.status(400).json({ error: "subject_id, title, date, start_time, end_time required" });
  try {
    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    const duration_min = (eh * 60 + em) - (sh * 60 + sm);
    const result = await query(
      `INSERT INTO sessions (subject_id, title, description, date, start_time, end_time, duration_min)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [subject_id, title, description || null, date, start_time, end_time, duration_min]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update session status
app.patch("/api/sessions/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!["planned","completed","skipped"].includes(status))
    return res.status(400).json({ error: "invalid status" });
  try {
    await query("UPDATE sessions SET status = ? WHERE id = ?", [status, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE session
app.delete("/api/sessions/:id", async (req, res) => {
  try {
    await query("DELETE FROM sessions WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
//  TASKS
// ============================================================

// GET all tasks
app.get("/api/tasks", async (req, res) => {
  const { subject_id, completed } = req.query;
  let sql = `SELECT t.*, sub.name AS subject_name, sub.color AS subject_color
             FROM tasks t
             JOIN subjects sub ON t.subject_id = sub.id
             WHERE 1=1`;
  const params = [];
  if (subject_id !== undefined) { sql += " AND t.subject_id = ?"; params.push(subject_id); }
  if (completed  !== undefined) { sql += " AND t.completed = ?";  params.push(completed); }
  sql += " ORDER BY t.due_date, FIELD(t.priority,'high','medium','low')";
  try {
    res.json(await query(sql, params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create task
app.post("/api/tasks", async (req, res) => {
  const { subject_id, session_id, title, due_date, priority } = req.body;
  if (!subject_id || !title)
    return res.status(400).json({ error: "subject_id and title required" });
  try {
    const result = await query(
      `INSERT INTO tasks (subject_id, session_id, title, due_date, priority)
       VALUES (?, ?, ?, ?, ?)`,
      [subject_id, session_id || null, title, due_date || null, priority || "medium"]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH toggle task completed
app.patch("/api/tasks/:id/toggle", async (req, res) => {
  try {
    await query("UPDATE tasks SET completed = NOT completed WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE task
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    await query("DELETE FROM tasks WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
//  GOALS
// ============================================================

// GET all goals
app.get("/api/goals", async (req, res) => {
  try {
    const rows = await query(
      `SELECT g.*, sub.name AS subject_name, sub.color AS subject_color
       FROM goals g JOIN subjects sub ON g.subject_id = sub.id
       ORDER BY g.deadline`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create goal
app.post("/api/goals", async (req, res) => {
  const { subject_id, title, target_hours, deadline } = req.body;
  if (!subject_id || !title || !target_hours)
    return res.status(400).json({ error: "subject_id, title, target_hours required" });
  try {
    const result = await query(
      "INSERT INTO goals (subject_id, title, target_hours, deadline) VALUES (?, ?, ?, ?)",
      [subject_id, title, target_hours, deadline || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH log hours to a goal
app.patch("/api/goals/:id/log", async (req, res) => {
  const { hours } = req.body;
  if (hours === undefined) return res.status(400).json({ error: "hours required" });
  try {
    await query(
      "UPDATE goals SET logged_hours = LEAST(logged_hours + ?, target_hours) WHERE id = ?",
      [hours, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE goal
app.delete("/api/goals/:id", async (req, res) => {
  try {
    await query("DELETE FROM goals WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
//  STATS  (dashboard summary)
// ============================================================
app.get("/api/stats", async (req, res) => {
  try {
    const [sessions]   = await query("SELECT COUNT(*) AS total, SUM(duration_min) AS mins FROM sessions WHERE status='completed'");
    const [tasks]      = await query("SELECT COUNT(*) AS total, SUM(completed) AS done FROM tasks");
    const [upcoming]   = await query("SELECT COUNT(*) AS total FROM sessions WHERE date >= CURDATE() AND status='planned'");
    res.json({
      completedSessions : sessions.total,
      totalMinutes      : sessions.mins || 0,
      totalTasks        : tasks.total,
      completedTasks    : tasks.done,
      upcomingSessions  : upcoming.total,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Catch-all → serve index.html ────────────────────────────
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

// ── Start ────────────────────────────────────────────────────
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀  Study Planner running at  http://localhost:${PORT}\n`);
    });
  })
  .catch((err) => {
    console.error("\n❌  Could not connect to MySQL:", err.message);
    console.error("    → Make sure XAMPP MySQL is running on port 3306\n");
    process.exit(1);
  });
