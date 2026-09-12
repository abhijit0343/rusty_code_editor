import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import Editor from './components/Editor.jsx'
import Terminal from './components/Terminal.jsx'
import { saveCode } from './api.js'

const STARTER = `print("Hello World!")\n`

const TOAST_MS = 3000

export default function App() {
  const [code, setCode]         = useState(STARTER)
  const [filename, setFilename] = useState('main')
  const [timeoutLimit, setTimeoutLimit]  = useState(15)

  const [running, setRunning]   = useState(false)
  const [socket, setSocket]     = useState(null)
  
  const [toast, setToast]           = useState(null)
  const [backendUp, setBackendUp]   = useState(false)

  /* Health-check & Socket init */
  useEffect(() => {
    // Determine backend URL (if running locally on different ports, it's 5000)
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    
    fetch(`${backendUrl}/health`)
      .then(r => setBackendUp(r.ok))
      .catch(() => setBackendUp(false))

    const newSocket = io(backendUrl)
    setSocket(newSocket)

    newSocket.on('connect', () => setBackendUp(true))
    newSocket.on('disconnect', () => setBackendUp(false))
    
    newSocket.on('exit', () => {
      setRunning(false)
    })

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

  /* Ctrl+Enter → Run */
  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault(); handleRun()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleRun])

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <span className="header-logo">🐍</span>
        <span className="header-title">Rusty Editor</span>
        <div className="header-spacer" />
        <div className="status">
          <span className={`status-dot ${backendUp ? '' : 'offline'}`} />
          {backendUp ? 'Connected' : 'Offline'}
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <input
          id="filename-input"
          className="filename-input"
          type="text"
          placeholder="filename"
          value={filename}
          onChange={e => setFilename(e.target.value)}
          spellCheck={false}
          aria-label="Filename"
        />

        <div className="toolbar-sep" />

        {!running ? (
          <button
            id="btn-run"
            className="btn btn-run"
            onClick={handleRun}
            disabled={!backendUp}
            title="Run (Ctrl+Enter)"
          >
            ▶ Run
          </button>
        ) : (
          <button
            id="btn-stop"
            className="btn"
            style={{ background: 'var(--red)', color: 'white' }}
            onClick={handleStop}
            title="Stop Execution"
          >
            ⏹ Stop
          </button>
        )}

        <button
          id="btn-save"
          className="btn btn-save"
          onClick={handleSave}
          title="Save to workspace"
        >
          💾 Save
        </button>

        <button
          id="btn-clear"
          className="btn btn-clear"
          onClick={handleClear}
          title="Clear output"
        >
          Clear
        </button>

        <div className="toolbar-sep" />

        <span className="timeout-label">Timeout</span>
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
          <div className={`toast ${toast.type}`} role="status">{toast.msg}</div>
        )}
      </div>

      {/* Main split */}
      <main className="main">
        {/* Left: editor */}
        <div className="editor-pane">
          <div className="pane-label">
            <span className="pane-dot" style={{ background: '#f1fa8c' }} />
            editor
            {filename && (
              <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                — {filename.endsWith('.py') ? filename : `${filename}.py`}
              </span>
            )}
          </div>
          <Editor value={code} onChange={setCode} />
        </div>

        {/* Right: terminal output */}
        <div className="output-pane">
          <div className="pane-label">
            <span className="pane-dot" style={{ background: '#8be9fd' }} />
            terminal
          </div>
          <Terminal socket={socket} running={running} />
        </div>
      </main>
    </div>
  )
}
