import React, { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'

export default function Terminal({ socket, running }) {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const runningRef = useRef(running)

  // Keep a ref of running state so we don't need to re-initialize xterm
  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js only once
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      theme: {
        background: '#0f1117',
        foreground: '#dde1f0',
        cursor: '#6c8ef5',
        selectionBackground: 'rgba(108, 142, 245, 0.3)',
      },
      convertEol: true,
      disableStdin: false,
    })

    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)

    xterm.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = xterm

    // Handle user input
    const disposable = xterm.onData((data) => {
      if (runningRef.current && socket) {
        // Ignore terminal escape sequences (like arrow keys, or terminal ID responses)
        // because Python's input() expects plain text and will crash if it receives them.
        if (data.startsWith('\x1b')) return;

        // Send to backend, translating Enter (\r) to newline (\n) for Python
        socket.emit('input', data.replace(/\r/g, '\n'))
        
        // Local echo so the user can see what they are typing
        for (let i = 0; i < data.length; i++) {
          const char = data[i];
          if (char === '\r') {
            xterm.write('\r\n');
          } else if (char === '\x7F') { // Handle backspace
            xterm.write('\b \b');
          } else {
            xterm.write(char);
          }
        }
      }
    })

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      disposable.dispose()
      window.removeEventListener('resize', handleResize)
      xterm.dispose()
      xtermRef.current = null
    }
  }, [socket]) // Only re-init if the socket connection completely changes

  // Hook up WebSocket events
  useEffect(() => {
    if (!socket) return

    const handleStdout = (data) => xtermRef.current?.write(data)
    
    const handleStderr = (data) => {
      xtermRef.current?.write('\x1b[31m' + data + '\x1b[0m')
    }

    const handleExit = ({ code, timeout }) => {
      const color = code === 0 ? '\x1b[32m' : '\x1b[31m'
      const status = timeout ? 'TIMED OUT' : `code ${code}`
      xtermRef.current?.write(`\r\n${color}> Process exited (${status}).\x1b[0m\r\n`)
    }

    const handleRunStarted = () => {
      if (xtermRef.current) {
        xtermRef.current.clear()
        xtermRef.current.write('\x1b[38;5;240m> Process started...\x1b[0m\r\n')
      }
    }

    const handleClearTerminal = () => {
      xtermRef.current?.clear()
    }

    socket.on('stdout', handleStdout)
    socket.on('stderr', handleStderr)
    socket.on('exit', handleExit)
    socket.on('run_started', handleRunStarted)
    socket.on('clear_terminal', handleClearTerminal)

    return () => {
      socket.off('stdout', handleStdout)
      socket.off('stderr', handleStderr)
      socket.off('exit', handleExit)
      socket.off('run_started', handleRunStarted)
      socket.off('clear_terminal', handleClearTerminal)
    }
  }, [socket])

  return (
    <div style={{ width: '100%', height: '100%', padding: '10px', overflow: 'hidden', background: 'var(--bg)' }}>
      <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
