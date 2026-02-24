-- Canvas App D1 Schema

CREATE TABLE IF NOT EXISTS DashboardAccess (
  id TEXT PRIMARY KEY,
  accessCode TEXT UNIQUE NOT NULL,
  accessCodeHash TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'researcher',
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS CodingCanvas (
  id TEXT PRIMARY KEY,
  dashboardAccessId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(dashboardAccessId, name),
  FOREIGN KEY (dashboardAccessId) REFERENCES DashboardAccess(id)
);

CREATE TABLE IF NOT EXISTS CanvasTranscript (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  caseId TEXT,
  sourceType TEXT,
  sourceId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CanvasQuestion (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  text TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  sortOrder INTEGER NOT NULL DEFAULT 0,
  parentQuestionId TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE,
  FOREIGN KEY (parentQuestionId) REFERENCES CanvasQuestion(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS CanvasMemo (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#FEF08A',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CanvasTextCoding (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  transcriptId TEXT NOT NULL,
  questionId TEXT NOT NULL,
  startOffset INTEGER NOT NULL,
  endOffset INTEGER NOT NULL,
  codedText TEXT NOT NULL,
  note TEXT,
  annotation TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE,
  FOREIGN KEY (transcriptId) REFERENCES CanvasTranscript(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES CanvasQuestion(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coding_canvas ON CanvasTextCoding(canvasId);
CREATE INDEX IF NOT EXISTS idx_coding_transcript ON CanvasTextCoding(transcriptId);
CREATE INDEX IF NOT EXISTS idx_coding_question ON CanvasTextCoding(questionId);
CREATE INDEX IF NOT EXISTS idx_coding_canvas_transcript ON CanvasTextCoding(canvasId, transcriptId);

CREATE TABLE IF NOT EXISTS CanvasNodePosition (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  nodeId TEXT NOT NULL,
  nodeType TEXT NOT NULL,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  width REAL,
  height REAL,
  collapsed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(canvasId, nodeId),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CanvasCase (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  name TEXT NOT NULL,
  attributes TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(canvasId, name),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CanvasRelation (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  fromType TEXT NOT NULL,
  fromId TEXT NOT NULL,
  toType TEXT NOT NULL,
  toId TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CanvasComputedNode (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  nodeType TEXT NOT NULL,
  label TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS CanvasShare (
  id TEXT PRIMARY KEY,
  canvasId TEXT NOT NULL,
  shareCode TEXT UNIQUE NOT NULL,
  createdBy TEXT NOT NULL,
  expiresAt TEXT,
  cloneCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (canvasId) REFERENCES CodingCanvas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resourceId TEXT,
  actorType TEXT NOT NULL DEFAULT 'researcher',
  actorId TEXT,
  ip TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  statusCode INTEGER,
  meta TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON AuditLog(action);
