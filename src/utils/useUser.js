import { useState, useEffect } from "react";
import { useSession } from "@auth/create/react";

const useUser = () => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (session?.user) {
      // Fetch latest profile from DB to get fresh role and allowed_sections
      fetch('/api/user/profile')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            setUser({ ...session.user, ...data.user });
          } else {
            setUser(session.user);
          }
        })
        .catch(() => setUser(session.user))
        .finally(() => setLoading(false));
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [session, status]);

  return {
    user,
    data: user,
    loading,
    refetch: () => { }
  };
};

export { useUser };
export default useUser;