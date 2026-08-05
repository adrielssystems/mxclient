"use client";
import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import ClientReportsView from "../components/ClientReportsView";

export default function ClientReportsPage() {
    const navigate = useNavigate();
    useEffect(() => {
        navigate("/", { replace: true });
    }, [navigate]);
    
    return <ClientReportsView />;
}
