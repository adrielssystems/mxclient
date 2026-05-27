
import useAuth from "@/utils/useAuth";

function MainComponent() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut({
      redirect: false,
    });
    // Manual redirect to ensure stability
    window.location.href = "/account/signin";
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0A0A0A] relative overflow-hidden font-sans text-white">

      {/* Background Gradients/Glows */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-motorx-red-DEFAULT opacity-20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-motorx-red-dark opacity-10 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 sm:p-10 text-center">

          {/* Logo Section */}
          <div className="flex flex-col items-center justify-center mb-10">
            <img src="/images/logo-new.png" alt="MotorX" className="h-20 w-auto mb-4 object-contain drop-shadow-[0_0_15px_rgba(227,30,36,0.5)]" />
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Sign Out</h1>
            <p className="text-gray-400 text-sm">Are you sure you want to exit your session?</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleSignOut}
              className="w-full bg-motorx-red-DEFAULT hover:bg-motorx-red-dark text-white font-semibold py-3.5 px-4 rounded-xl shadow-[0_0_20px_rgba(227,30,36,0.3)] hover:shadow-[0_0_30px_rgba(227,30,36,0.5)] transition-all duration-300 transform hover:-translate-y-0.5 mt-2 uppercase tracking-wide"
            >
              Confirm Sign Out
            </button>

            <a
              href="/dashboard"
              className="block w-full bg-transparent hover:bg-white/5 text-gray-300 font-semibold py-3.5 px-4 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300"
            >
              Cancel
            </a>
          </div>

          {/* Footer */}
          <div className="mt-8 text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} MotorX LLC</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;
