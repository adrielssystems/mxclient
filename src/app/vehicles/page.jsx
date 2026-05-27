"use client";
import React, { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import ClientVehiclesTable from "../components/ClientVehiclesTable";

export default function ClientVehiclesPage() {
    const { data: user, loading: userLoading } = useUser();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        fetch("/api/client/vehicles", { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { vehicles: [] })
            .then(d => setVehicles(d.vehicles || []))
            .catch(err => {
                console.error("Failed to load vehicles", err);
                setVehicles([]);
            })
            .finally(() => setLoading(false));
    }, [user]);

    if (userLoading || (loading && vehicles.length === 0)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">My Vehicles</h1>
                <p className="text-slate-500 mt-1">Track the transport and payment status of your purchases.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ClientVehiclesTable vehicles={vehicles} />
            </div>
        </div>
    );
}
