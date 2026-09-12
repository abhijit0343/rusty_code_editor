import MonacoEditor from '@monaco-editor/react'

/**
 * Editor – Monaco wrapper for Python.
 *
 * Props
 * -----
 * value    {string}   Current editor content (controlled).
 * onChange {Function} Called with the new string whenever the user edits.
 */
export default function Editor({ value, onChange }) {
  return (
    <div className="editor-wrap">
      <MonacoEditor
        height="100%"
        defaultLanguage="python"
        language="python"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
          tabSize: 4,
          insertSpaces: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          // Match the dark theme of the rest of the UI
          'semanticHighlighting.enabled': true,
        }}
      />
    </div>
  )
}
