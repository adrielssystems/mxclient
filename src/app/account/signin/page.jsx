
import { useState } from "react";
import useAuth from "@/utils/useAuth";

function MainComponent() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signInWithCredentials, signOut } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithCredentials({
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials or sign-in failed.");
        setLoading(false);
      } else {
        // Fetch session to determine role for routing
        try {
          const sessionRes = await fetch("/api/user/profile");
          if (sessionRes.ok) {
            const data = await sessionRes.json();
            const role = (data.user?.role || "").toLowerCase();

            if (role === "client" || role === "user" || role === "sub_client" || role === "admin") {
              window.location.href = "/";
            } else {
              // Sign out immediately as this is client-only portal
              await signOut({ redirect: false });
              setError("This portal is exclusively for client accounts");
              setLoading(false);
            }
          } else {
            await signOut({ redirect: false });
            setError("Failed to verify user profile access.");
            setLoading(false);
          }
        } catch (e) {
          await signOut({ redirect: false });
          setError("Failed to verify user profile access.");
          setLoading(false);
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0A] relative overflow-hidden font-sans text-white">

      {/* Background Gradients/Glows */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-motorx-red-DEFAULT opacity-20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-motorx-red-dark opacity-10 rounded-full blur-[150px]"></div>
        {/* Grid or texture overlay if needed, keeping it clean for now */}
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 sm:p-10">

          {/* Logo Section */}
          <div className="flex flex-col items-center justify-center mb-10">
            {/* Using the copied logo */}
            <img src="/images/logo-new.png" alt="MotorX" className="h-20 w-auto mb-4 object-contain drop-shadow-[0_0_15px_rgba(227,30,36,0.5)]" />
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400 text-sm">Enter your credentials to access the portal</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-gray-800 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-motorx-red-DEFAULT focus:border-transparent outline-none transition-all placeholder-gray-600 group-hover:border-gray-700"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
              <div className="relative group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-gray-800 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-motorx-red-DEFAULT focus:border-transparent outline-none transition-all placeholder-gray-600 group-hover:border-gray-700"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-motorx-red-DEFAULT/10 border border-motorx-red-DEFAULT/20 rounded-lg text-motorx-red-light text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-motorx-red-DEFAULT hover:bg-motorx-red-dark text-white font-semibold py-3.5 px-4 rounded-xl shadow-[0_0_20px_rgba(227,30,36,0.3)] hover:shadow-[0_0_30px_rgba(227,30,36,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer / Links */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} MotorX LLC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;
