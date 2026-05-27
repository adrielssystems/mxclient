import { useIdleTimer } from 'react-idle-timer';
import useAuth from '@/utils/useAuth';
import { useSession } from "@auth/create/react";
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

export default function SessionTimeout() {
    const { signOut } = useAuth();
    // @ts-ignore
    const { data: session, status } = useSession();
    const [isMounted, setIsMounted] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Watch for unexpected session loss with a small grace period to handle redeploys/restarts
    useEffect(() => {
        if (!isMounted) return;

        const publicPaths = ['/account/signin', '/account/signup', '/account/logout', '/', '/admin-setup'];
        const pathname = location.pathname;
        const isPublicPath = publicPaths.includes(pathname);

        // If unauthenticated, wait 2 seconds before redirecting to see if it was a transient error (like a deploy)
        let timeout;
        if (status === 'unauthenticated' && !isPublicPath) {
            timeout = setTimeout(() => {
                console.warn('Session truly expired or server is up and session is invalid. Redirecting...');
                navigate(`/account/signin?callbackUrl=${encodeURIComponent(pathname)}&error=SessionExpired`, { replace: true });
            }, 30000); // 30-second grace period for server restarts (deploys)
        }

        return () => clearTimeout(timeout);
    }, [status, location.pathname, isMounted, navigate]);

    const handleOnIdle = () => {
        if (status === 'authenticated') {
            console.log('User is idle, signing out...');
            signOut({ redirect: false }).then(() => {
                navigate('/account/signin?error=SessionExpired', { replace: true });
            });
        }
    };

    const { activate } = useIdleTimer({
        timeout: 60 * 60 * 1000, // 1 hour of total inactivity before logout
        promptBeforeIdle: 5 * 60 * 1000, // Show warning 5 minutes before logout (at 55 min mark)
        onPrompt: () => {
            if (status === 'authenticated') {
                import('sonner').then(({ toast }) => {
                    toast.warning("Your session is about to expire", {
                        description: "You will be automatically signed out in 5 minutes due to inactivity.",
                        action: {
                            label: "Extend session",
                            onClick: () => activate()
                        },
                        duration: Infinity,
                        id: 'session-warning'
                    });
                });
            }
        },
        onActive: () => {
            import('sonner').then(({ toast }) => {
                toast.dismiss('session-warning');
            });
        },
        onIdle: handleOnIdle,
        debounce: 500,
        crossTab: true,
        leaderElection: true,
        syncTimers: 200,
        disabled: !isMounted || status !== 'authenticated'
    });

    return null;
}
