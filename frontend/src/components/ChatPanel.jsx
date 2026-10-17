import { useState, useRef, useEffect } from "react"
import { apiJson } from "../api/client"

// ChatPanel is the chatbot UI component.
// It receives a meetingId prop so it knows which meeting to query.
// If meetingId is null it searches across ALL meetings.
function ChatPanel({ meetingId = null }) {
  // messages — the conversation history shown in the chat window
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: meetingId
        ? "Hi! Ask me anything about this meeting — decisions made, action items, what was discussed, or why certain choices were made."
        : "Hi! Ask me anything across all your uploaded meetings."
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // This ref lets us auto-scroll to the latest message
  const bottomRef = useRef(null)

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput("")

    // Add user message to chat immediately
    setMessages(prev => [...prev, { role: "user", content: question }])
    setLoading(true)

    try {
      const data = await apiJson("/chat/ask", {
        method: "POST",
        json: { question, meeting_id: meetingId },
      })
      setMessages(prev => [...prev, { role: "assistant", content: data.answer, sources: data.sources }])
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Sorry, something went wrong: ${err.message}`, error: true }])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed bottom-8 right-8 z-50 bg-[#00d4e8] text-[#0d1117] 
                    p-4 rounded-full shadow-lg shadow-[#00d4e8]/20
                    transition-all duration-300 flex items-center gap-3
                    ${isHovered ? "scale-105 px-6" : ""}`}
      >
        {isHovered && <span className="font-semibold whitespace-nowrap text-sm">Ask Recall.</span>}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 w-[400px] h-[600px] max-h-[80vh] flex flex-col 
                    bg-[#161b22] border border-[#21262d] rounded-2xl overflow-hidden shadow-2xl
                    animate-in slide-in-from-bottom-4 duration-300">

      {/* Chat header */}
      <div className="px-5 py-4 border-b border-[#21262d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00d4e8] animate-pulse"></div>
          <span className="text-white text-sm font-medium">
            Ask Recall<span className="text-[#00d4e8]">.</span>
          </span>
          <span className="text-gray-500 text-xs ml-2">
            {meetingId ? "This meeting" : "All meetings"}
          </span>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          aria-label="Minimise chat"
          className="text-gray-500 hover:text-white transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%]">

              {/* Message bubble */}
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#00d4e8] text-[#0d1117] font-medium rounded-tr-sm"
                  : `bg-[#0d1117] border border-[#21262d] rounded-tl-sm ${msg.error ? "text-red-400" : "text-white"}`
              }`}>
                {msg.content}
              </div>

              {/* Sources: the transcript chunks the answer was retrieved from */}
              {msg.sources?.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {msg.sources.map((src) => (
                    <div key={src.meeting_id} className="bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2">
                      <p className="text-[#00d4e8] text-xs font-medium truncate">📄 {src.filename}</p>
                      <p className="text-gray-500 text-xs leading-relaxed mt-0.5">{src.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator — shows while waiting for AI response */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0d1117] border border-[#21262d] rounded-2xl 
                            rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00d4e8] 
                                animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#00d4e8] 
                                animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#00d4e8] 
                                animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Invisible div at the bottom — we scroll to this */}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-4 border-t border-[#21262d] flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          maxLength={2000}
          placeholder={meetingId ? "Ask about this meeting..." : "Ask about your meetings..."}
          disabled={loading}
          className="flex-1 bg-[#0d1117] border border-[#21262d] text-white 
                     placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm
                     focus:outline-none focus:border-[#00d4e8] transition-colors
                     disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-[#00d4e8] hover:bg-[#00b8cc] disabled:opacity-40
                     disabled:cursor-not-allowed text-[#0d1117] font-semibold 
                     px-4 py-2.5 rounded-xl transition-colors text-sm"
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default ChatPanel