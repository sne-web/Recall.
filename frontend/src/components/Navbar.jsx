import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { apiFetch, clearSession } from "../api/client"

function Navbar({ profile, onEditName }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || ""

  // Close the profile menu when clicking anywhere outside it
  useEffect(() => {
    if (!showDropdown) return
    function handleClick(e) {
      if (!dropdownRef.current?.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showDropdown])

  function handleLogout() {
    clearSession()
    navigate("/login")
  }

  async function handleDeleteAccount() {
    setShowDropdown(false)
    if (!confirm("Permanently delete your account and all of your meetings? This cannot be undone.")) return
    try {
      await apiFetch("/auth/me", { method: "DELETE" })
      clearSession()
      navigate("/")
    } catch (err) {
      alert(`Could not delete account: ${err.message}`)
    }
  }

  function navClass(path) {
    return `text-sm transition-colors ${
      location.pathname === path ? "text-[#00d4e8] font-medium" : "text-gray-400 hover:text-white"
    }`
  }

  return (
    <nav className="w-full bg-[#161b22] border-b border-[#21262d] px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        <button
          onClick={() => navigate("/dashboard")}
          className="text-2xl font-bold text-white hover:opacity-80 transition-opacity"
        >
          Recall<span className="text-[#00d4e8]">.</span>
        </button>

        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/dashboard")} className={navClass("/dashboard")}>Dashboard</button>
          <button onClick={() => navigate("/upload")} className={navClass("/upload")}>Upload</button>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 hover:bg-[#21262d] px-3 py-2 rounded-xl transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-[#00d4e8]"></div>
            <span className="text-gray-400 text-sm whitespace-nowrap max-w-[10rem] truncate">
              {displayName || "Account"}
            </span>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-[#161b22] border border-[#21262d] rounded-xl shadow-2xl py-1 z-50">
              {profile?.email && (
                <div className="px-4 py-3 text-xs text-gray-400 truncate border-b border-[#21262d] mb-1 font-medium">
                  {profile.email}
                </div>
              )}
              <button
                onClick={() => { setShowDropdown(false); onEditName() }}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#21262d] transition-colors"
              >
                Change display name
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#21262d] transition-colors"
              >
                Log out
              </button>
              <div className="border-t border-[#21262d] my-1"></div>
              <button
                onClick={handleDeleteAccount}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              >
                Delete account
              </button>
            </div>
          )}
        </div>

      </div>
    </nav>
  )
}

export default Navbar
