const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Configure which chapter to use via env var CHAPTER (default to Chapter 13)
const CHAPTER = process.env.CHAPTER || 'Chapter 13';
const MOCK_ROOT = path.resolve(__dirname, '..', CHAPTER, 'MyOnlineSupport', 'API', 'mocks');

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch (e) {
    return false;
  }
}

function dirExists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch (e) {
    return false;
  }
}

// Recursively resolve path segments, allowing dynamic segment placeholder named '__'
function resolveMockDir(rootDir, segments) {
  let cur = rootDir;
  for (const seg of segments) {
    const tryPath = path.join(cur, seg);
    if (dirExists(tryPath)) {
      cur = tryPath;
      continue;
    }
    const dyn = path.join(cur, '__');
    if (dirExists(dyn)) {
      cur = dyn;
      continue;
    }
    // not found
    return null;
  }
  return cur;
}

// Parse a .mock file that contains raw HTTP response text (status line, headers, blank line, body)
function parseMock(content) {
  // Normalize line endings
  const lines = content.replace(/\r/g, '').split('\n');
  let idx = 0;
  // Status line
  let statusCode = 200;
  if (lines[idx] && lines[idx].startsWith('HTTP/')) {
    const parts = lines[idx].split(' ');
    if (parts.length >= 2) {
      statusCode = parseInt(parts[1], 10) || 200;
    }
    idx++;
  }
  const headers = {};
  // Read headers until empty line
  while (idx < lines.length && lines[idx].trim() !== '') {
    const h = lines[idx];
    const sep = h.indexOf(':');
    if (sep > -1) {
      const name = h.slice(0, sep).trim();
      const value = h.slice(sep + 1).trim();
      headers[name] = value;
    }
    idx++;
  }
  // Skip blank line
  while (idx < lines.length && lines[idx].trim() === '') idx++;
  const body = lines.slice(idx).join('\n');
  return { statusCode, headers, body };
}

async function findAndSendMock(req, res) {
  try {
    const relPath = req.path.replace(/^\//, '');
    const segments = relPath === '' ? [] : relPath.split('/');

    // Attempt to resolve directory using segments
    const dir = resolveMockDir(MOCK_ROOT, segments);
    if (!dir) {
      return res.status(404).json({ error: 'Mock directory not found' });
    }

    const method = req.method.toUpperCase();
    const candidate = path.join(dir, method + '.mock');
    if (!fileExists(candidate)) {
      // If OPTIONS request and no file, try OPTIONS mock in parent dir
      if (method === 'OPTIONS') {
        const parentOptions = path.join(dir, 'OPTIONS.mock');
        if (fileExists(parentOptions)) {
          const raw = fs.readFileSync(parentOptions, 'utf8');
          const parsed = parseMock(raw);
          Object.entries(parsed.headers).forEach(([k, v]) => res.setHeader(k, v));
          return res.status(parsed.statusCode).send(parsed.body);
        }
      }
      return res.status(404).json({ error: `No mock for method ${method} at ${req.path}` });
    }

    const raw = fs.readFileSync(candidate, 'utf8');
    const parsed = parseMock(raw);
    // Set headers
    Object.entries(parsed.headers).forEach(([k, v]) => {
      // Avoid overriding transfer-encoding or content-length from Express
      if (k.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(k, v);
    });
    res.status(parsed.statusCode);
    // Try to send JSON if content-type says so
    const ct = (parsed.headers['Content-Type'] || parsed.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      try {
        const obj = JSON.parse(parsed.body);
        return res.json(obj);
      } catch (e) {
        // fallback
      }
    }
    return res.send(parsed.body);
  } catch (err) {
    console.error('Error serving mock:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Catch-all route - serve mocks based on path
app.all('/*', (req, res) => {
  findAndSendMock(req, res);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Mock API server listening on http://localhost:${port}`);
  console.log(`Using mocks root: ${MOCK_ROOT}`);
});
