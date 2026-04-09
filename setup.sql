-- ============================================================
--  Study Planner - MySQL Setup for XAMPP
--  HOW TO RUN:
--  1. Open phpMyAdmin → http://localhost/phpmyadmin
--  2. Click "Import" tab → choose this file → click "Go"
--  OR via terminal:  mysql -u root < setup.sql
-- ============================================================

DROP DATABASE IF EXISTS study_planner;
CREATE DATABASE study_planner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE study_planner;

-- ── Subjects ─────────────────────────────────────────────────
CREATE TABLE subjects (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(7)   NOT NULL DEFAULT '#6c63ff',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Study Sessions ────────────────────────────────────────────
-- duration_min is stored as a plain INT (calculated by server)
-- to avoid generated-column issues on MySQL 5.7 / MariaDB
CREATE TABLE sessions (
  id           INT          NOT NULL AUTO_INCREMENT,
  subject_id   INT          NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  date         DATE         NOT NULL,
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  duration_min INT          DEFAULT 0,
  status       VARCHAR(10)  NOT NULL DEFAULT 'planned',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_session_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Tasks ─────────────────────────────────────────────────────
CREATE TABLE tasks (
  id         INT          NOT NULL AUTO_INCREMENT,
  subject_id INT          NOT NULL,
  session_id INT,
  title      VARCHAR(200) NOT NULL,
  due_date   DATE,
  priority   VARCHAR(10)  NOT NULL DEFAULT 'medium',
  completed  TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_task_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Goals ─────────────────────────────────────────────────────
CREATE TABLE goals (
  id           INT          NOT NULL AUTO_INCREMENT,
  subject_id   INT          NOT NULL,
  title        VARCHAR(200) NOT NULL,
  target_hours DECIMAL(6,1) NOT NULL DEFAULT 0,
  logged_hours DECIMAL(6,1) NOT NULL DEFAULT 0,
  deadline     DATE,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_goal_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Seed Data ─────────────────────────────────────────────────
INSERT INTO subjects (name, color) VALUES
  ('Mathematics',  '#f59e0b'),
  ('Physics',      '#10b981'),
  ('Literature',   '#ef4444'),
  ('Programming',  '#6366f1');

-- ── Verify ────────────────────────────────────────────────────
SELECT 'Setup complete!' AS status;
SHOW TABLES;
