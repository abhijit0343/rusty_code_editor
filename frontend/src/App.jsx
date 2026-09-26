import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import Editor from './components/Editor.jsx'
import Terminal from './components/Terminal.jsx'
import { saveCode } from './api.js'

const STARTER = `print("Hello World!")\n`
const TOAST_MS = 3000

/* ── Inline SVG icons (no emoji, no external icon lib) ────────── */
const IconPlay = () => (
  <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor" aria-hidden="true">
    <path d="M1 1.5v8l7-4-7-4z" />
  </svg>
)

const IconStop = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
    <rect x="1" y="1" width="8" height="8" rx="1" />
  </svg>
)

const IconSave = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
       strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 1h7l2 2v8a1 1 0 01-1 1H2a1 1 0 01-1-1V2a1 1 0 011-1z" />
    <path d="M4 1v3h4V1" />
    <path d="M3 7h6" />
    <path d="M3 9h4" />
  </svg>
)

/* ── Logo mark (replaces snake emoji) ─────────────────────────── */
const LogoMark = () => (
  <div className="header-logo" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="currentColor">
      {/* Python-style two-snake motif simplified to "py" letterform */}
      <text x="2" y="17" fontSize="14" fontFamily="monospace" fill="white" fontWeight="bold">py</text>
    </svg>
  </div>
)

export default function App() {
  const [code, setCode]                 = useState(STARTER)
  const [filename, setFilename]         = useState('main')
  const [timeoutLimit, setTimeoutLimit] = useState(15)
  const [running, setRunning]           = useState(false)
  const [socket, setSocket]             = useState(null)
  const [toast, setToast]               = useState(null)
  const [backendUp, setBackendUp]       = useState(false)

  /* Health-check & Socket init */
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    fetch(`${backendUrl}/health`)
      .then(r => setBackendUp(r.ok))
      .catch(() => setBackendUp(false))

    const newSocket = io(backendUrl)
    setSocket(newSocket)

    newSocket.on('connect',    () => setBackendUp(true))
    newSocket.on('disconnect', () => setBackendUp(false))
    newSocket.on('exit',       () => setRunning(false))

    return () => newSocket.close()
  }, [])

  /* Toast helper */
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    const id = globalThis.setTimeout(() => setToast(null), TOAST_MS)
    return () => globalThis.clearTimeout(id)
  }, [])

  /* Run */
  const handleRun = useCallback(() => {
    if (running || !socket) return
    setRunning(true)
    socket.emit('run', { code, timeout: timeoutLimit })
  }, [code, running, socket, timeoutLimit])

  /* Stop */
  const handleStop = useCallback(() => {
    if (!running || !socket) return
    socket.emit('stop')
  }, [running, socket])

  /* Save */
  const handleSave = useCallback(async () => {
    if (!filename.trim()) { showToast('Enter a filename.', 'error'); return }
    try {
      const r = await saveCode(filename.trim(), code)
      showToast(r.message ?? 'Saved!', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }, [code, filename, showToast])

  /* Clear output */
  const handleClear = useCallback(() => {
    if (socket) socket.emit('clear_terminal')
  }, [socket])

  /* Ctrl+Enter -> Run */
  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault(); handleRun()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRun])

  /* Derive displayed filename */
  const displayFilename = filename
    ? (filename.endsWith('.py') ? filename : `${filename}.py`)
    : null

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <LogoMark />
        <span className="header-title">Rusty Editor</span>
        <div className="header-spacer" />
        <div className="status" aria-live="polite" aria-label={backendUp ? 'Backend online' : 'Backend offline'}>
          <span className={`status-dot${backendUp ? '' : ' offline'}`} />
          {backendUp ? 'Online' : 'Offline'}
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="toolbar" role="toolbar" aria-label="Editor controls">
        <input
          id="filename-input"
          className="filename-input"
          type="text"
          placeholder="filename"
          value={filename}
          onChange={e => setFilename(e.target.value)}
          spellCheck={false}
          aria-label="Filename (without .py)"
        />

        <div className="toolbar-sep" aria-hidden="true" />

        {!running ? (
          <button
            id="btn-run"
            className="btn btn-run"
            onClick={handleRun}
            disabled={!backendUp}
            title="Run (Ctrl+Enter)"
            aria-label="Run code"
          >
            <IconPlay /> Run
          </button>
        ) : (
          <button
            id="btn-stop"
            className="btn btn-stop"
            onClick={handleStop}
            title="Stop execution"
            aria-label="Stop execution"
          >
            <IconStop /> Stop
          </button>
        )}

        <button
          id="btn-save"
          className="btn btn-save"
          onClick={handleSave}
          title="Save to workspace"
          aria-label="Save file"
        >
          <IconSave /> Save
        </button>

        <button
          id="btn-clear"
          className="btn btn-clear"
          onClick={handleClear}
          title="Clear terminal output"
          aria-label="Clear terminal"
        >
          Clear
        </button>

        <div className="toolbar-sep" aria-hidden="true" />

        <label htmlFor="timeout-select" className="timeout-label">Timeout</label>
        <select
          id="timeout-select"
          className="timeout-select"
          value={timeoutLimit}
          onChange={e => setTimeoutLimit(Number(e.target.value))}
          title="Max execution time"
        >
          {[5, 10, 15, 20, 30, 60].map(s => (
            <option key={s} value={s}>{s}s</option>
          ))}
        </select>

        {toast && (
          <div className={`toast ${toast.type}`} role="status" aria-live="polite">
            {toast.msg}
          </div>
        )}
      </div>

      {/* ── Main split ── */}
      <main className="main">
        {/* Left: editor */}
        <div className="editor-pane">
          <div className="pane-label">
            <span
              className="pane-dot"
              style={{ background: running ? 'var(--green)' : 'var(--accent)' }}
              aria-hidden="true"
            />
            Editor
            {displayFilename && (
              <>
                <span className="pane-sep" aria-hidden="true">/</span>
                <span className="pane-filename">{displayFilename}</span>
              </>
            )}
          </div>
          <Editor value={code} onChange={setCode} />
        </div>

        {/* Right: terminal output */}
        <div className="output-pane">
          <div className="pane-label">
            <span
              className="pane-dot"
              style={{ background: 'var(--muted)' }}
              aria-hidden="true"
            />
            Terminal
          </div>
          <Terminal socket={socket} running={running} />
        </div>
      </main>
    </div>
  )
}
