// Single place where the frontend talks to the backend.
// Handles auth headers, transparent token refresh, and readable error messages.

const ACCESS_KEY = "token"
const REFRESH_KEY = "refresh_token"

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export function getToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function saveSession({ access_token, refresh_token }) {
  localStorage.setItem(ACCESS_KEY, access_token)
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token)
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Supabase access tokens expire after ~1 hour. If several requests hit a 401 at
// once, they all wait on the same refresh call instead of each starting one.
let refreshPromise = null

async function refreshSession() {
  const refresh_token = localStorage.getItem(REFRESH_KEY)
  if (!refresh_token) return false

  refreshPromise ??= fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      saveSession(await res.json())
      return true
    })
    .catch(() => false)
    .finally(() => { refreshPromise = null })

  return refreshPromise
}

async function errorMessage(res) {
  try {
    const { detail } = await res.json()
    if (typeof detail === "string") return detail
    // FastAPI validation errors: [{ loc, msg, ... }]
    if (Array.isArray(detail)) return detail.map((d) => d.msg.replace(/^Value error, /, "")).join(". ")
  } catch {
    // Non-JSON body, e.g. an HTML error page from the hosting proxy
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return "The server is waking up or unavailable. Please try again in a moment."
  }
  return `Request failed (${res.status})`
}

/**
 * fetch() wrapper for `/api/...` routes.
 *   apiFetch("/transcripts")                          -> Response
 *   apiFetch("/chat/ask", { method: "POST", json })   -> sends JSON body
 *   apiFetch("/auth/login", { ..., auth: false })     -> no token / refresh handling
 * Throws ApiError with a user-facing message on any non-2xx response.
 */
export async function apiFetch(path, { json, auth = true, retry = true, ...options } = {}) {
  const headers = new Headers(options.headers)
  const token = auth ? getToken() : null
  if (token) headers.set("Authorization", `Bearer ${token}`)

  let body = options.body
  if (json !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(json)
  }

  let res
  try {
    res = await fetch(`/api${path}`, { ...options, headers, body })
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }

  if (res.status === 401 && token) {
    if (retry && (await refreshSession())) {
      return apiFetch(path, { json, auth, retry: false, ...options })
    }
    clearSession()
    window.location.assign("/login?expired=1")
    throw new ApiError("Your session has expired. Please log in again.", 401)
  }

  if (!res.ok) throw new ApiError(await errorMessage(res), res.status)
  return res
}

export async function apiJson(path, options) {
  const res = await apiFetch(path, options)
  return res.json()
}

/** Downloads an authenticated file response (CSV/PDF export) via a temporary blob URL. */
export async function downloadFile(path, fallbackName) {
  const res = await apiFetch(path)
  const disposition = res.headers.get("Content-Disposition") || ""
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || fallbackName

  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
