import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import ChatPanel from "../components/ChatPanel"
import { apiJson, downloadFile } from "../api/client"

const TABS = [
  { key: "decisions", label: (m) => `Decisions (${m.decisions.length})` },
  { key: "action_items", label: (m) => `Action Items (${m.action_items.length})` },
  { key: "sentiment", label: () => "Sentiment" },
  { key: "transcript", label: () => "Transcript" },
]

const SENTIMENT_TEXT = {
  positive: "text-green-400",
  negative: "text-red-400",
  neutral: "text-gray-400",
  mixed: "text-yellow-400",
  conflict: "text-red-400",
  agreement: "text-green-400",
}

const SENTIMENT_BG = {
  positive: "bg-green-500/10 border-green-500/20",
  negative: "bg-red-500/10 border-red-500/20",
  neutral: "bg-gray-500/10 border-gray-500/20",
  mixed: "bg-yellow-500/10 border-yellow-500/20",
}

const PRIORITY = {
  high: "text-red-400 bg-red-500/10 border-red-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-green-400 bg-green-500/10 border-green-500/20",
}

const FLAGS = [
  { key: "has_conflict", label: "Conflict detected", icon: "⚡" },
  { key: "has_strong_agreement", label: "Strong agreement", icon: "🤝" },
  { key: "has_frustration", label: "Frustration present", icon: "😤" },
  { key: "has_enthusiasm", label: "Enthusiasm present", icon: "🚀" },
]

const sentimentText = (s) => SENTIMENT_TEXT[s] || "text-gray-400"

function MeetingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("decisions")

  useEffect(() => {
    setLoading(true)
    apiJson(`/transcripts/${id}`)
      .then(setMeeting)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleAnalyse() {
    setAnalysing(true)
    setError("")
    try {
      // Runs extraction + sentiment through the LLM and indexes the transcript for chat
      const result = await apiJson(`/analysis/analyse/${id}`, { method: "POST" })
      setMeeting((prev) => ({ ...prev, ...result }))
    } catch (err) {
      setError(`Analysis failed: ${err.message}`)
    } finally {
      setAnalysing(false)
    }
  }

  async function handleExport(format) {
    setError("")
    try {
      await downloadFile(`/export/${id}/${format}`, `meeting_analysis.${format}`)
    } catch (err) {
      setError(`Export failed: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Loading meeting...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <p className="text-red-400">{loadError}</p>
        <button onClick={() => navigate("/dashboard")} className="mt-4 text-[#00d4e8] text-sm">
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  const processed = meeting.status === "processed"
  const sentiment = meeting.sentiment

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-8">
        <div className="min-w-0">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-500 hover:text-white text-sm mb-3 transition-colors flex items-center gap-1"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white break-all">{meeting.filename}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-400">
            <span>📅 {new Date(meeting.upload_date).toLocaleDateString()}</span>
            <span>📝 {meeting.word_count?.toLocaleString()} words</span>
            <span>🎤 {meeting.speakers?.join(", ") || "No speakers detected"}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {!processed ? (
            <button
              onClick={handleAnalyse}
              disabled={analysing}
              className="bg-[#00d4e8] hover:bg-[#00b8cc] disabled:opacity-50
                         disabled:cursor-not-allowed text-[#0d1117] font-semibold
                         px-6 py-3 rounded-xl transition-colors text-sm"
            >
              {analysing ? "Analysing..." : "✨ Analyse with AI"}
            </button>
          ) : (
            <>
              <button
                onClick={handleAnalyse}
                disabled={analysing}
                className="text-gray-400 hover:text-white disabled:opacity-50 text-sm px-3 py-2 transition-colors"
              >
                {analysing ? "Re-analysing..." : "↻ Re-analyse"}
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="bg-[#161b22] hover:bg-[#21262d] border border-[#21262d]
                           text-white font-medium px-4 py-2 rounded-xl transition-colors text-sm flex items-center gap-2"
              >
                <DownloadIcon /> Export CSV
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="bg-[#00d4e8]/10 hover:bg-[#00d4e8]/20 border border-[#00d4e8]/30
                           text-[#00d4e8] font-medium px-4 py-2 rounded-xl transition-colors text-sm flex items-center gap-2"
              >
                <DownloadIcon /> Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {analysing && (
        <div className="mb-6 p-6 bg-[#161b22] border border-[#21262d] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00d4e8] animate-pulse"></div>
            <p className="text-white text-sm">The AI is reading your transcript and extracting insights...</p>
          </div>
          <p className="text-gray-500 text-xs mt-2 ml-5">
            This usually takes 15-30 seconds depending on transcript length.
          </p>
        </div>
      )}

      {/* Not yet analysed */}
      {!processed && !analysing && (
        <div className="text-center py-16 border-2 border-dashed border-[#21262d] rounded-2xl">
          <div className="text-5xl mb-4">✨</div>
          <h2 className="text-white font-semibold text-lg mb-2">Ready to analyse</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Click "Analyse with AI" above to extract decisions, action items,
            and sentiment from this transcript.
          </p>
        </div>
      )}

      {processed && (
        <>
          {/* Sentiment overview banner */}
          {sentiment && (
            <div className={`p-4 rounded-xl border mb-6 ${SENTIMENT_BG[sentiment.overall_sentiment] || SENTIMENT_BG.neutral}`}>
              <span className="text-white text-sm font-medium">Overall meeting tone: </span>
              <span className={`text-sm font-semibold capitalize ${sentimentText(sentiment.overall_sentiment)}`}>
                {sentiment.overall_sentiment}
              </span>
              {sentiment.summary && <p className="text-gray-400 text-xs mt-2">{sentiment.summary}</p>}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-[#161b22] p-1 rounded-xl border border-[#21262d] w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.key
                    ? "bg-[#00d4e8] text-[#0d1117] font-semibold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label(meeting)}
              </button>
            ))}
          </div>

          {activeTab === "decisions" && (
            meeting.decisions.length === 0 ? (
              <p className="text-gray-400 text-sm">No decisions found in this transcript.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#21262d]">
                      <th className="text-left text-gray-500 text-xs font-medium pb-3 pr-4 w-12">#</th>
                      <th className="text-left text-gray-500 text-xs font-medium pb-3 pr-4 w-1/3">DECISION</th>
                      <th className="text-left text-gray-500 text-xs font-medium pb-3">CONTEXT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d]">
                    {meeting.decisions.map((decision, i) => (
                      <tr key={i} className="hover:bg-[#161b22]/50 transition-colors">
                        <td className="py-4 pr-4 align-top">
                          <span className="text-[#00d4e8] text-sm font-mono">{String(i + 1).padStart(2, "0")}</span>
                        </td>
                        <td className="py-4 pr-4 align-top">
                          <span className="text-white text-sm font-medium">{decision.description}</span>
                        </td>
                        <td className="py-4 align-top">
                          <span className="text-gray-400 text-sm">{decision.context}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === "action_items" && (
            meeting.action_items.length === 0 ? (
              <p className="text-gray-400 text-sm">No action items found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#21262d]">
                      <th className="text-left text-gray-500 text-xs font-medium pb-3 pr-4">WHO</th>
                      <th className="text-left text-gray-500 text-xs font-medium pb-3 pr-4">WHAT</th>
                      <th className="text-left text-gray-500 text-xs font-medium pb-3 pr-4">BY WHEN</th>
                      <th className="text-left text-gray-500 text-xs font-medium pb-3">PRIORITY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d]">
                    {meeting.action_items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-4 pr-4 align-top">
                          <span className="text-[#00d4e8] text-sm font-medium">{item.who}</span>
                        </td>
                        <td className="py-4 pr-4 align-top">
                          <span className="text-white text-sm">{item.what}</span>
                        </td>
                        <td className="py-4 pr-4 align-top">
                          <span className="text-gray-400 text-sm">{item.by_when}</span>
                        </td>
                        <td className="py-4 align-top">
                          <span className={`text-xs px-2 py-1 rounded-full border capitalize ${PRIORITY[item.priority] || PRIORITY.medium}`}>
                            {item.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === "sentiment" && sentiment && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {FLAGS.map((flag) => (
                  <div
                    key={flag.key}
                    className={`p-4 rounded-xl border text-center ${
                      sentiment.flags?.[flag.key]
                        ? "bg-[#00d4e8]/10 border-[#00d4e8]/30"
                        : "bg-[#161b22] border-[#21262d] opacity-40"
                    }`}
                  >
                    <div className="text-2xl mb-1">{flag.icon}</div>
                    <p className="text-white text-xs">{flag.label}</p>
                  </div>
                ))}
              </div>

              {sentiment.speaker_sentiments?.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3 text-sm">Per-speaker breakdown</h3>
                  <div className="space-y-3">
                    {sentiment.speaker_sentiments.map((s, i) => (
                      <div key={i} className="bg-[#161b22] border border-[#21262d] rounded-xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm font-medium">{s.speaker}</span>
                          <span className={`text-xs font-medium capitalize ${sentimentText(s.sentiment)}`}>{s.sentiment}</span>
                        </div>
                        <p className="text-gray-500 text-xs">{s.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sentiment.segments?.length > 0 && (
                <div>
                  <h3 className="text-white font-medium mb-3 text-sm">Discussion segments</h3>
                  <div className="space-y-2">
                    {sentiment.segments.map((seg, i) => (
                      <div key={i} className="flex items-center justify-between bg-[#161b22] border border-[#21262d] rounded-xl px-4 py-3">
                        <span className="text-white text-sm">{seg.topic}</span>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <span className={`text-xs capitalize ${sentimentText(seg.sentiment)}`}>{seg.sentiment}</span>
                          <span className="text-gray-600 text-xs">·</span>
                          <span className="text-gray-500 text-xs capitalize">{seg.intensity} intensity</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "transcript" && (
            <pre className="bg-[#161b22] border border-[#21262d] rounded-xl p-6 text-gray-300 text-sm
                            whitespace-pre-wrap font-sans leading-relaxed max-h-[70vh] overflow-y-auto">
              {meeting.transcript_text}
            </pre>
          )}

          <ChatPanel meetingId={id} />
        </>
      )}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export default MeetingDetail
