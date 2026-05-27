
"use client";
import { useEffect, useState } from "react";
import { useSession } from "@auth/create/react";

export default function SessionHeartbeat() {
    // @ts-ignore
    const { status } = useSession();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isMounted || status !== "authenticated") return;

        const interval = setInterval(async () => {
            try {
                await fetch("/api/auth/heartbeat", { method: "POST" });
            } catch (err) {
                console.error("Heartbeat failed", err);
            }
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(interval);
    }, [status, isMounted]);

    return null;
}
