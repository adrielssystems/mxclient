import { useState, useEffect } from "react";
import { useSession } from "@auth/create/react";

let globalCachedUser = null;

const useUser = () => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState(globalCachedUser);
  const [loading, setLoading] = useState(!globalCachedUser);

  useEffect(() => {
    if (status === 'loading') return;

    const hasImpersonation = typeof document !== 'undefined' && 
      document.cookie.split(';').some(c => c.trim().startsWith('motorx-impersonate='));

    if (session?.user || hasImpersonation) {
      // Fetch latest profile from DB to get fresh role, allowed_sections, and can_access_auctions
      fetch('/api/user/profile')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            const freshUser = { ...(session?.user || {}), ...data.user };
            globalCachedUser = freshUser;
            setUser(freshUser);
          } else if (session?.user) {
            globalCachedUser = session.user;
            setUser(session.user);
          }
        })
        .catch(() => {
          if (!globalCachedUser && session?.user) {
            globalCachedUser = session.user;
            setUser(session.user);
          }
        })
        .finally(() => setLoading(false));
    } else {
      globalCachedUser = null;
      setUser(null);
      setLoading(false);
    }
  }, [session, status]);

  return {
    user,
    data: user,
    loading: loading && !user,
    refetch: () => { }
  };
};

export { useUser };
export default useUser;