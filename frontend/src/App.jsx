import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Welcome from "./pages/Welcome"
import Dashboard from "./pages/Dashboard"
import Upload from "./pages/Upload"
import MeetingDetail from "./pages/MeetingDetail"
import Login from "./pages/Login"
import Register from "./pages/Register"
import AppLayout from "./components/AppLayout"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Signed-in area: AppLayout guards on the token and renders the navbar once */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/meeting/:id" element={<MeetingDetail />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
