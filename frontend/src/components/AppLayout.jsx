import { useState, useEffect } from "react"
import { Navigate, Outlet } from "react-router-dom"
import Navbar from "./Navbar"
import NameModal from "./NameModal"
import { apiJson, getToken } from "../api/client"

// Wraps every signed-in page: redirects to /login without a token, loads the
// user's profile once, and shares it with child pages via <Outlet context>.
function AppLayout() {
  const token = getToken()
  const [profile, setProfile] = useState(null)
  const [editingName, setEditingName] = useState(false)

  useEffect(() => {
    if (!token) return
    apiJson("/auth/me")
      .then((data) => {
        setProfile(data)
        if (!data.full_name) setEditingName(true)  // first visit: ask for a display name
      })
      .catch(() => {})  // 401s are handled (redirect) inside apiJson
  }, [token])

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen">
      <Navbar profile={profile} onEditName={() => setEditingName(true)} />

      {editingName && profile && (
        <NameModal
          initialName={profile.full_name}
          onSaved={(full_name) => {
            setProfile((p) => ({ ...p, full_name }))
            setEditingName(false)
          }}
          onClose={profile.full_name ? () => setEditingName(false) : null}
        />
      )}

      <Outlet context={{ profile }} />
    </div>
  )
}

export default AppLayout
