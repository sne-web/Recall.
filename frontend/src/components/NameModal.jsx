import { useState } from "react"
import { apiJson } from "../api/client"

// onClose is null on first sign-in, when a display name is required to continue.
function NameModal({ initialName = "", onSaved, onClose }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError("")
    try {
      const data = await apiJson("/auth/me/name", { method: "PUT", json: { full_name: name.trim() } })
      onSaved(data.full_name)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[#161b22] border border-[#21262d] rounded-2xl p-8 max-w-md w-full shadow-2xl relative text-left"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
        <h2 className="text-white text-2xl font-bold mb-2">
          {initialName ? "Change display name" : "Welcome! What should we call you?"}
        </h2>
        <p className="text-gray-400 text-sm mb-6">This name is shown on your dashboard.</p>
        <input
          type="text"
          autoFocus
          maxLength={100}
          placeholder="e.g. Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#0d1117] border border-[#21262d] text-white
                     placeholder-gray-600 rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:border-[#00d4e8] transition-colors mb-4"
        />
        {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full bg-[#00d4e8] hover:bg-[#00b8cc] text-[#0d1117]
                     font-semibold py-3 rounded-xl transition-all disabled:opacity-50 text-sm"
        >
          {saving ? "Saving..." : initialName ? "Save" : "Continue to Dashboard →"}
        </button>
      </form>
    </div>
  )
}

export default NameModal
