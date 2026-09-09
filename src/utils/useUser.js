import { useState, useEffect } from "react";
import { useSession } from "@auth/create/react";

let globalCachedUser = null;

const useUser = () => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState(globalCachedUser);
  const [loading, setLoading] = useState(!globalCachedUser);

  useEffect(() => {
    if (status === 'loading') return;

    if (session?.user) {
      // Fetch latest profile from DB to get fresh role and allowed_sections
      fetch('/api/user/profile')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          const freshUser = data?.user ? { ...session.user, ...data.user } : session.user;
          globalCachedUser = freshUser;
          setUser(freshUser);
        })
        .catch(() => {
          if (!globalCachedUser) {
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