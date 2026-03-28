-- ════════════════════════════════════════════════════════════════
-- PH0xBIA — Supabase Schema + RLS
-- Run this ONCE in the Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════
--
-- Tables:
--   1. sessions          — mirrors on-chain session ("Asylum Wards")
--   2. session_covens     — covens within a session (co-op mode)
--   3. session_players    — players per session/coven
--   4. task_state         — co-op task + puzzle solve records
--   5. player_positions   — position persistence for reconnect
--   6. sanity_events      — sanity change log (analytics + anti-cheat)
--
-- After running this SQL:
--   → Enable Realtime on: task_state, session_players, player_positions, sanity_events
--   → Verify RLS is enabled on all 6 tables
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- 1. SESSIONS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  session_id   BIGINT PRIMARY KEY,
  seed         TEXT NOT NULL,                              -- curse seed hex from contract
  is_coop      BOOLEAN DEFAULT FALSE,
  max_covens   INT NOT NULL DEFAULT 1,                     -- 1 for solo, 2-4 for co-op
  status       TEXT NOT NULL DEFAULT 'open',               -- open | active | resolved | expired
  created_at   TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────────
-- 2. SESSION_COVENS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE session_covens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   BIGINT REFERENCES sessions(session_id) ON DELETE CASCADE,
  coven_id     INT NOT NULL,                               -- 0, 1, 2, 3
  UNIQUE(session_id, coven_id)
);


-- ────────────────────────────────────────────────────────────────
-- 3. SESSION_PLAYERS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE session_players (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     BIGINT REFERENCES sessions(session_id) ON DELETE CASCADE,
  coven_id       INT NOT NULL DEFAULT 0,
  wallet_address TEXT NOT NULL,
  role           TEXT,                                      -- 'P1','P2','P3' for co-op role assignment
  escaped        BOOLEAN NOT NULL DEFAULT FALSE,
  escaped_at     TIMESTAMPTZ,
  sanity         INT NOT NULL DEFAULT 100,                  -- current sanity %
  UNIQUE(session_id, wallet_address)
);


-- ────────────────────────────────────────────────────────────────
-- 4. TASK_STATE  (co-op tasks + puzzle solves)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE task_state (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   BIGINT REFERENCES sessions(session_id) ON DELETE CASCADE,
  coven_id     INT NOT NULL,
  task_type    TEXT NOT NULL,                               -- co-op: 'whisper_code' | 'seance_circle' | 'possessed_relay' | 'blood_ritual_levers'
                                                            -- puzzle: 'blood_cipher' | 'patient_numbers' | 'evp_recording' | 'binary_locks' | 'ritual_sequence' | 'patient_anagram'
  player_addr  TEXT NOT NULL,
  action       TEXT NOT NULL,                               -- 'triggered' | 'completed' | 'failed' | 'puzzle_solved'
  payload      JSONB,                                       -- e.g. {lever: 'left'} or {puzzleId: 'p1'}
  created_at   TIMESTAMPTZ DEFAULT now()                    -- SERVER time — used for sync window checks
);


-- ────────────────────────────────────────────────────────────────
-- 5. PLAYER_POSITIONS  (for reconnect recovery)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE player_positions (
  session_id     BIGINT REFERENCES sessions(session_id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  x              FLOAT NOT NULL DEFAULT 400,
  y              FLOAT NOT NULL DEFAULT 300,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (session_id, wallet_address)
);


-- ────────────────────────────────────────────────────────────────
-- 6. SANITY_EVENTS  (analytics + anti-cheat)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE sanity_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     BIGINT REFERENCES sessions(session_id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  event_type     TEXT NOT NULL,                             -- 'red_herring' | 'ghost_contact' | 'jump_scare' | 'puzzle_fail' | 'puzzle_solve' | 'regen'
  sanity_delta   INT NOT NULL,                              -- negative for drain, positive for regen
  sanity_after   INT NOT NULL,                              -- sanity value after this event
  created_at     TIMESTAMPTZ DEFAULT now()
);


-- ════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════

CREATE INDEX idx_session_players_session ON session_players(session_id);
CREATE INDEX idx_session_players_wallet ON session_players(wallet_address);
CREATE INDEX idx_task_state_session ON task_state(session_id);
CREATE INDEX idx_task_state_player ON task_state(session_id, player_addr, action);
CREATE INDEX idx_player_positions_session ON player_positions(session_id);
CREATE INDEX idx_sanity_events_session ON sanity_events(session_id);


-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_covens ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanity_events ENABLE ROW LEVEL SECURITY;

-- ── Sessions ──
CREATE POLICY "Sessions are viewable by everyone"
  ON sessions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create sessions"
  ON sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Sessions can be updated"
  ON sessions FOR UPDATE USING (true);

-- ── Session Covens ──
CREATE POLICY "Covens are viewable by everyone"
  ON session_covens FOR SELECT USING (true);

CREATE POLICY "Covens can be inserted"
  ON session_covens FOR INSERT WITH CHECK (true);

-- ── Session Players ──
CREATE POLICY "Players are viewable by everyone"
  ON session_players FOR SELECT USING (true);

CREATE POLICY "Players can join sessions"
  ON session_players FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update own record"
  ON session_players FOR UPDATE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'sub');

-- ── Task State ──
CREATE POLICY "Task state is viewable by everyone"
  ON task_state FOR SELECT USING (true);

CREATE POLICY "Players can insert task actions"
  ON task_state FOR INSERT WITH CHECK (true);

-- ── Player Positions ──
CREATE POLICY "Positions are viewable by everyone"
  ON player_positions FOR SELECT USING (true);

CREATE POLICY "Players can upsert own position"
  ON player_positions FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can update own position"
  ON player_positions FOR UPDATE
  USING (wallet_address = current_setting('request.jwt.claims', true)::json->>'sub');

-- ── Sanity Events ──
CREATE POLICY "Sanity events are viewable"
  ON sanity_events FOR SELECT USING (true);

CREATE POLICY "Players can log sanity events"
  ON sanity_events FOR INSERT WITH CHECK (true);
