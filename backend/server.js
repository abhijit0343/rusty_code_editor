/**
 * server.js – Express & Socket.io backend for Rusty Editor.
 */

import express    from 'express'
import cors       from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { join, basename } from 'node:path'
import { writeFileSync, mkdirSync, unlinkSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname }       from 'node:path'
import { tmpdir }    from 'node:os'
import { spawn }     from 'node:child_process'

// Paths
const __filename   = fileURLToPath(import.meta.url)
const __dirname    = dirname(__filename)
const WORKSPACE    = join(__dirname, '..', 'workspace')
mkdirSync(WORKSPACE, { recursive: true })

// App setup
const app  = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*", // allow Vite dev server
    methods: ["GET", "POST"]
  }
})

const PORT = process.env.PORT ?? 5000

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// Helpers
function safeFilename(name) {
  name = basename(name.trim())
  if (!name.endsWith('.py')) name += '.py'
  if (name === '.py') throw new Error('Invalid filename.')
  return name
}

function clampTimeout(raw) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return 15
  return Math.min(Math.max(n, 1), 60)
}

const PYTHON = process.platform === 'win32' ? 'python' : 'python3'

// WebSocket Connection
io.on('connection', (socket) => {
  let child = null;
  let timer = null;
  let tmpFile = null;
  let tmpDir = null;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    if (child) {
      try { child.kill('SIGKILL'); } catch (e) {}
      child = null;
    }
    if (tmpFile) {
      try { unlinkSync(tmpFile); } catch (e) {}
      tmpFile = null;
    }
    if (tmpDir) {
      try { unlinkSync(tmpDir); } catch (e) {}
      tmpDir = null;
    }
  };

  socket.on('run', ({ code, timeout }) => {
    // Cleanup any existing run
    cleanup();

    const timeoutSec = clampTimeout(timeout ?? 15);

    try {
      tmpDir  = mkdtempSync(join(tmpdir(), 'Rusty Editor-'))
      tmpFile = join(tmpDir, 'code.py')
      writeFileSync(tmpFile, code, 'utf8')
    } catch (err) {
      socket.emit('stderr', `\r\nFailed to write temp file: ${err.message}\r\n`);
      socket.emit('exit', { code: 1 });
      return;
    }

    try {
      socket.emit('run_started');
      child = spawn(PYTHON, ['-u', tmpFile], {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      socket.emit('stderr', `\r\nCould not start Python: ${err.message}\r\n`);
      socket.emit('exit', { code: 1 });
      cleanup();
      return;
    }

    child.stdout.on('data', (chunk) => {
      // Replace bare newlines with \r\n for xterm.js
      socket.emit('stdout', chunk.toString().replace(/(?<!\r)\n/g, '\r\n'));
    });

    child.stderr.on('data', (chunk) => {
      socket.emit('stderr', chunk.toString().replace(/(?<!\r)\n/g, '\r\n'));
    });

    timer = setTimeout(() => {
      socket.emit('stderr', `\r\n⏱  Execution timed out after ${timeoutSec} second(s).\r\nTip: increase the timeout in the editor toolbar.\r\n`);
      cleanup();
      socket.emit('exit', { code: 1, timeout: true });
    }, timeoutSec * 1000);

    child.on('close', (code) => {
      cleanup();
      socket.emit('exit', { code });
    });

    child.on('error', (err) => {
      socket.emit('stderr', `\r\nCould not start Python: ${err.message}\r\nMake sure "${PYTHON}" is on your PATH.\r\n`);
      cleanup();
      socket.emit('exit', { code: 1 });
    });
  });

  socket.on('input', (data) => {
    if (child && child.stdin) {
      child.stdin.write(data);
    }
  });

  socket.on('stop', () => {
    socket.emit('stderr', `\r\nKeyboardInterrupt\r\n`);
    cleanup();
    socket.emit('exit', { code: 130 }); // standard code for Ctrl+C
  });

  socket.on('disconnect', () => {
    cleanup();
  });
});


// HTTP Routes (Keep save and health)
app.post('/save', (req, res) => {
  const { filename, code } = req.body

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: "'filename' is required." })
  }
  if (typeof code !== 'string') {
    return res.status(400).json({ error: "'code' must be a string." })
  }

  let safe
  try {
    safe = safeFilename(filename)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  writeFileSync(join(WORKSPACE, safe), code, 'utf8')
  res.json({ message: `Saved as ${safe}` })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Start
httpServer.listen(PORT, () => {
  console.log('')
  console.log('  🐍 Rusty Editor — Node/Express/Socket.io backend')
  console.log(`  Listening on http://localhost:${PORT}`)
  console.log(`  Workspace   → ${WORKSPACE}`)
  console.log('')
})
