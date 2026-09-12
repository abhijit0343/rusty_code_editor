/**
 * api.js – Thin fetch wrappers for the Flask backend.
 *
 * All functions return a plain object on success OR throw an Error so
 * the caller can handle failures in a try/catch or .catch().
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * POST /run
 * @param {string} code    Python source to execute.
 * @param {string} [stdin='']  Text to pipe as stdin (for input() calls).
 * @param {number} [timeout=5] Max execution seconds (1-30).
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export async function runCode(code, stdin = '', timeout = 5) {
  const res = await fetch(`${BASE_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, stdin, timeout }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.stderr || err.error || `Server error ${res.status}`);
  }

  return res.json();
}

/**
 * POST /save
 * @param {string} filename  Base filename (without extension is fine).
 * @param {string} code      Python source to persist.
 * @returns {Promise<{message: string}>}
 */
export async function saveCode(filename, code) {
  const res = await fetch(`${BASE_URL}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, code }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  return res.json();
}
