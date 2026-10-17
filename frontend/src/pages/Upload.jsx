import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { apiJson } from "../api/client"

// Only these file types are allowed (the backend enforces the same list)
const ALLOWED = [".txt", ".vtt"]

function Upload() {
  const navigate = useNavigate()

  // dragging — tracks whether user is currently dragging a file over the drop zone
  const [dragging, setDragging] = useState(false)
  // files — list of files the user has selected but not yet uploaded
  const [files, setFiles] = useState([])
  // uploading — true while we're sending files to the backend
  const [uploading, setUploading] = useState(false)
  // error — any error message to show the user
  const [error, setError] = useState("")
  // uploaded — the results returned from the backend after successful upload
  const [uploaded, setUploaded] = useState([])

  // useRef lets us programmatically click the hidden file input
  const fileInputRef = useRef(null)

  function getExtension(filename) {
    return filename.slice(filename.lastIndexOf(".")).toLowerCase()
  }

  function validateFiles(fileList) {
    // Convert FileList object to a regular array
    const arr = Array.from(fileList)
    const invalid = arr.filter(f => !ALLOWED.includes(getExtension(f.name)))
    if (invalid.length > 0) {
      setError(`Unsupported file type: ${invalid.map(f => f.name).join(", ")}. Only .txt and .vtt files are allowed.`)
      return []
    }
    setError("")
    return arr
  }

  // Called when user drags a file over the drop zone
  function handleDragOver(e) {
    e.preventDefault() // Prevent browser default (opening the file)
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

  // Called when user drops files onto the drop zone
  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const valid = validateFiles(e.dataTransfer.files)
    if (valid.length > 0) setFiles(valid)
  }

  // Called when user selects files through the file browser
  function handleFileSelect(e) {
    const valid = validateFiles(e.target.files)
    if (valid.length > 0) setFiles(valid)
    e.target.value = ""  // so picking the same file again still fires onChange
  }

  async function handleUpload() {
    if (files.length === 0) return

    setUploading(true)
    setError("")

    try {
      // FormData is how we send files to the backend
      // It's like a special envelope that can hold file data
      const formData = new FormData()
      files.forEach(file => {
        // "files" must match the parameter name in our FastAPI endpoint
        formData.append("files", file)
      })

      // No Content-Type header: the browser sets multipart/form-data with the right boundary
      const data = await apiJson("/transcripts/upload", { method: "POST", body: formData })
      setUploaded(data.uploaded)
      setFiles([]) // Clear the selected files

    } catch (err) {
      setError(err.message)
    } finally {
      // This runs whether upload succeeded or failed
      setUploading(false)
    }
  }

  function formatWordCount(count) {
    return count.toLocaleString() + " words"
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">Upload Transcripts</h1>
      <p className="text-gray-400 mb-8">
        Upload your meeting transcripts to extract decisions, action items and insights.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-[#00d4e8] bg-[#00d4e8]/5"
            : "border-[#21262d] hover:border-[#00d4e8]/50 bg-[#161b22]"
        }`}
      >
        {/* Hidden file input — triggered by clicking the drop zone */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.vtt"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="text-4xl mb-4">📁</div>
        <p className="text-white font-medium mb-1">
          Drop your transcript files here
        </p>
        <p className="text-gray-500 text-sm">
          or click to browse — .txt and .vtt files supported
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Selected files list — shows before uploading */}
      {files.length > 0 && (
        <div className="mt-6">
          <h2 className="text-white font-medium mb-3">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </h2>
          <div className="space-y-2 mb-6">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-[#161b22] 
                           border border-[#21262d] rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[#00d4e8] text-sm font-mono">
                    {getExtension(file.name)}
                  </span>
                  <span className="text-white text-sm">{file.name}</span>
                </div>
                <span className="text-gray-500 text-xs">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-[#00d4e8] hover:bg-[#00b8cc] disabled:opacity-50
                       disabled:cursor-not-allowed text-[#0d1117] font-semibold 
                       py-3 rounded-xl transition-colors"
          >
            {uploading ? "Uploading..." : `Upload ${files.length} file${files.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Success results — shows after successful upload */}
      {uploaded.length > 0 && (
        <div className="mt-8">
          <h2 className="text-white font-medium mb-4">
            ✅ Successfully uploaded {uploaded.length} transcript{uploaded.length > 1 ? "s" : ""}
          </h2>
          <div className="space-y-3">
            {uploaded.map((meeting) => (
              <button
                key={meeting.id}
                onClick={() => navigate(`/meeting/${meeting.id}`)}
                className="w-full text-left bg-[#161b22] border border-[#21262d] hover:border-[#00d4e8]/50
                           rounded-xl p-4 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{meeting.filename}</span>
                  <span className="text-[#00d4e8] text-xs">
                    {formatWordCount(meeting.word_count)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    🎤 {meeting.speakers.length > 0
                      ? `${meeting.speakers.length} speaker${meeting.speakers.length > 1 ? "s" : ""} detected`
                      : "No speakers detected"}
                  </span>
                  <span>
                    📅 {new Date(meeting.upload_date).toLocaleDateString()}
                  </span>
                  <span className="ml-auto text-[#00d4e8]">Open &amp; analyse →</span>
                </div>
              </button>
            ))}
          </div>

          {/* Navigation buttons after upload */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setUploaded([])}
              className="flex-1 border border-[#21262d] hover:border-[#00d4e8] 
                         text-gray-400 hover:text-white py-3 rounded-xl 
                         transition-colors text-sm"
            >
              Upload more
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex-1 bg-[#00d4e8] hover:bg-[#00b8cc] text-[#0d1117] 
                         font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Upload