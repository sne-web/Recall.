import { useState, useEffect } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import ChatPanel from "../components/ChatPanel"
import { apiFetch, apiJson } from "../api/client"

function Dashboard() {
  const navigate = useNavigate()
  const { profile } = useOutletContext()

  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    apiJson("/transcripts")
      .then((data) => setMeetings(data.meetings))
      .catch((err) => setError(`Could not load meetings: ${err.message}`))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(e, meetingId) {
    // The delete button sits inside the clickable card — don't also open the meeting
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this meeting?")) return

    try {
      await apiFetch(`/transcripts/${meetingId}`, { method: "DELETE" })
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId))
    } catch (err) {
      alert(`Could not delete meeting: ${err.message}`)
    }
  }

  function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  }

  const processedCount = meetings.filter((m) => m.status === "processed").length
  const actionItemCount = meetings.reduce((sum, m) => sum + (m.action_items_count || 0), 0)

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Good to see you{profile?.full_name ? `, ${profile.full_name}` : ""} 👋
          </h1>
          <p className="text-gray-400">
            {loading
              ? "Loading your workspace..."
              : meetings.length === 0
                ? "Upload your first meeting transcript to get started."
                : `You have ${meetings.length} meeting${meetings.length > 1 ? "s" : ""} in your workspace.`}
          </p>
        </div>
        <button
          onClick={() => navigate("/upload")}
          className="bg-[#00d4e8] hover:bg-[#00b8cc] text-[#0d1117]
                     font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          + Upload Transcript
        </button>
      </div>

      {/* Stats row */}
      {meetings.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Total Meetings</p>
            <p className="text-3xl font-bold text-white">{meetings.length}</p>
          </div>
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Analysed</p>
            <p className="text-3xl font-bold text-white">
              {processedCount}
              <span className="text-gray-500 text-lg font-normal">/{meetings.length}</span>
            </p>
          </div>
          <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Action Items</p>
            <p className="text-3xl font-bold text-white">{actionItemCount}</p>
          </div>
        </div>
      )}

      {/* Chat across all analysed meetings */}
      {processedCount > 0 && <ChatPanel />}

      {loading && (
        <div className="text-center py-20">
          <p className="text-gray-400">Loading meetings...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && meetings.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed border-[#21262d] rounded-2xl">
          <div className="text-5xl mb-4">🎙️</div>
          <h2 className="text-white font-semibold text-lg mb-2">No meetings yet</h2>
          <p className="text-gray-400 text-sm mb-6">Upload a transcript to start extracting insights</p>
          <button
            onClick={() => navigate("/upload")}
            className="bg-[#00d4e8] hover:bg-[#00b8cc] text-[#0d1117]
                       font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Upload your first transcript
          </button>
        </div>
      )}

      {/* Meetings grid */}
      {meetings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meetings.map((meeting) => {
            const processed = meeting.status === "processed"
            return (
              <div
                key={meeting.id}
                onClick={() => navigate(`/meeting/${meeting.id}`)}
                className="bg-[#161b22] border border-[#21262d] hover:border-[#00d4e8]/50
                           rounded-2xl p-6 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-white font-medium text-sm leading-tight break-all
                                 group-hover:text-[#00d4e8] transition-colors">
                    {meeting.filename}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded-full ml-2 flex-shrink-0 ${
                    processed
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                  }`}>
                    {processed ? "✓ Analysed" : "⏳ Not analysed"}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>📅 {formatDate(meeting.upload_date)}</span>
                    <span>{meeting.word_count?.toLocaleString()} words</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>
                      🎤 {meeting.speakers?.length > 0
                        ? `${meeting.speakers.length} speaker${meeting.speakers.length > 1 ? "s" : ""}`
                        : "No speakers detected"}
                    </span>
                    {processed && (
                      <span>
                        {meeting.decisions_count} decision{meeting.decisions_count === 1 ? "" : "s"} ·{" "}
                        {meeting.action_items_count} action item{meeting.action_items_count === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-[#00d4e8] text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    View details →
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, meeting.id)}
                    className="text-gray-600 hover:text-red-400 text-xs
                               opacity-0 group-hover:opacity-100 focus:opacity-100
                               transition-all px-2 py-1 rounded-lg hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Dashboard
