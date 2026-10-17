import { Link } from "react-router-dom"
import { getToken } from "../api/client"

function Welcome() {
  const signedIn = !!getToken()

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Header */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-center max-w-7xl mx-auto z-10">
        <h1 className="text-2xl font-bold text-white">
          Recall<span className="text-[#00d4e8]">.</span>
        </h1>
      </div>

      {/* Hero Content */}
      <div className="text-center w-full max-w-4xl mt-24 z-10 relative flex flex-col items-center">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00d4e8] rounded-full mix-blend-screen filter blur-[128px] opacity-20"></div>
        <h2 className="text-5xl md:text-7xl font-extrabold text-white mb-6 leading-tight">
          Never lose what was <span className="text-[#00d4e8]">said again.</span>
        </h2>
        <p className="text-gray-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
          Upload your meeting transcripts and let AI pull out the decisions, action items and tone,
          then ask questions across every meeting you've had.
        </p>

        {/* Auth Required */}
        <div className="w-full max-w-md bg-[#161b22]/90 backdrop-blur-md border border-[#21262d] rounded-2xl p-8 shadow-2xl relative text-left">
          <h2 className="text-white text-2xl font-semibold mb-2">{signedIn ? "Welcome back" : "Get Started"}</h2>
          <p className="text-gray-400 text-sm mb-6">
            {signedIn ? "You're already signed in." : "Create an account or log in to access your meetings."}
          </p>

          {signedIn ? (
            <Link
              to="/dashboard"
              className="block w-full bg-[#00d4e8] hover:bg-[#00b8cc] text-[#0d1117]
                         font-semibold py-3 rounded-xl transition-all text-sm text-center"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <div className="flex flex-col space-y-4">
              <Link
                to="/login"
                className="w-full bg-[#00d4e8] hover:bg-[#00b8cc] text-[#0d1117]
                           font-semibold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(0,212,232,0.2)] hover:shadow-[0_0_25px_rgba(0,212,232,0.4)] text-sm text-center"
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="w-full bg-transparent border border-[#21262d] hover:bg-[#21262d] text-white
                           font-semibold py-3 rounded-xl transition-all text-sm text-center"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Feature Grid */}
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full z-10 relative pb-12">
        <div className="bg-[#161b22]/80 backdrop-blur-sm border border-[#21262d] p-8 rounded-2xl hover:border-[#00d4e8]/50 transition-colors group">
          <div className="h-12 w-12 bg-[#00d4e8]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#00d4e8]/20 transition-colors">
            <svg className="w-6 h-6 text-[#00d4e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          </div>
          <h3 className="text-white text-xl font-semibold mb-3">Decisions &amp; Action Items</h3>
          <p className="text-gray-400">Every decision and every task, with who owns it, when it's due and how urgent it is.</p>
        </div>
        <div className="bg-[#161b22]/80 backdrop-blur-sm border border-[#21262d] p-8 rounded-2xl hover:border-[#00d4e8]/50 transition-colors group">
          <div className="h-12 w-12 bg-[#00d4e8]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#00d4e8]/20 transition-colors">
            <svg className="w-6 h-6 text-[#00d4e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3 className="text-white text-xl font-semibold mb-3">Tone &amp; Dynamics</h3>
          <p className="text-gray-400">See the overall mood, how each speaker came across, and where conflict or agreement showed up.</p>
        </div>
        <div className="bg-[#161b22]/80 backdrop-blur-sm border border-[#21262d] p-8 rounded-2xl hover:border-[#00d4e8]/50 transition-colors group">
          <div className="h-12 w-12 bg-[#00d4e8]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#00d4e8]/20 transition-colors">
            <svg className="w-6 h-6 text-[#00d4e8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <h3 className="text-white text-xl font-semibold mb-3">Ask Your Meetings</h3>
          <p className="text-gray-400">Ask questions in plain English and get answers grounded in your transcripts, with the source meeting cited.</p>
        </div>
      </div>
    </div>
  )
}

export default Welcome