"use client";
import React, { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { Car, MapPin, CheckCircle, Clock, AlertCircle, DollarSign, Plus, ChevronRight } from "lucide-react";
import { useNavigate } from 'react-router';

export default function ClientDashboard() {
    const navigate = useNavigate();
    const { data: user, loading } = useUser();
    const [vehicles, setVehicles] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    const fetchVehicles = () => {
        fetch("/api/client/vehicles", { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { vehicles: [], recentPayments: [] })
            .then(d => {
                setVehicles(d.vehicles || []);
                setRecentPayments(d.recentPayments || []);
            })
            .catch(err => console.error("Failed to load client vehicles", err))
            .finally(() => setDataLoading(false));
    };

    useEffect(() => {
        if (!user) return;
        fetchVehicles();
    }, [user]);

    if (loading || (dataLoading && vehicles.length === 0)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    // Active Vehicles: Any vehicle not marked as delivered/canceled
    const activeVehicles = vehicles.filter(v => !['delivered', 'canceled'].includes(v.current_status));

    // --- Helper Functions ---
    const getStatusGroup = (v) => {
        // Group statuses into the UI categories requested by the user
        const status = v.current_status || '';
        if (['purchased', 'entered', 'assignment_pending'].includes(status)) return 'ACTION_REQUIRED';
        if (['dispatched', 'in_transit', 'booked', 'loaded', 'in_transit_ocean', 'at_terminal'].includes(status)) return 'IN_TRANSIT';
        if (['arrived', 'customs_cleared', 'delivered'].includes(status)) return 'DELIVERED';
        return status.toUpperCase();
    };

    const getStatusBadge = (statusGroup) => {
        switch (statusGroup) {
            case 'ACTION_REQUIRED': return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-max"><AlertCircle size={14} /> Setup Delivery</span>;
            case 'IN_TRANSIT': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-max"><Clock size={14} /> In Transit</span>;
            case 'DELIVERED': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-max"><CheckCircle size={14} /> Delivered</span>;
            default: return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold w-max">{statusGroup}</span>;
        }
    };

    // Take top 5 active vehicles for the dashboard snippet
    const displayVehicles = activeVehicles.slice(0, 5);

    // Using live recentPayments state from API

    return (
        <div className="font-sans animate-in fade-in duration-300">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Active Vehicles List (Takes 2/3 width) */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            My Active Vehicles
                        </h3>
                        <a href="/vehicles" className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                            View All <ChevronRight size={16} />
                        </a>
                    </div>

                    <div className="space-y-4">
                        {displayVehicles.length === 0 ? (
                            <div className="bg-white/70 backdrop-blur-md p-10 rounded-2xl border border-white/20 shadow-lg text-center">
                                <Car className="mx-auto h-12 w-12 text-slate-200 mb-3" />
                                <p className="text-slate-500 font-medium">No active vehicles found in transit.</p>
                            </div>
                        ) : (
                            displayVehicles.map((v, i) => {
                                const uiStatus = getStatusGroup(v);
                                return (
                                    <div key={v.vin || i} className={`bg-white/70 backdrop-blur-md p-5 rounded-2xl border shadow-xl transition-all hover:shadow-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4
                                        ${uiStatus === 'ACTION_REQUIRED' ? 'border-orange-200/50' : 'border-white/20'}
                                    `}>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                <h4 className="font-bold text-slate-800 text-lg sm:text-base truncate">{v.year} {v.make} {v.model}</h4>
                                                {getStatusBadge(uiStatus)}
                                                {v.payment_status && (
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${String(v.payment_status).toLowerCase() === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                        {['pending', 'payment_pending'].includes(String(v.payment_status).toLowerCase()) ? 'Pending Payment' : String(v.payment_status).replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-sm text-slate-500">
                                                <p className="truncate"><span className="font-semibold text-slate-700">VIN:</span> {v.vin}</p>
                                                <p className="truncate"><span className="font-semibold text-slate-700">Lot:</span> #{v.lot_number || 'N/A'}</p>
                                                <p className="flex items-center gap-1 truncate" title={v.auction_name}><MapPin size={14} className="flex-shrink-0" /> {v.auction_name || 'Terminal'}</p>
                                                {v.destination_country && (
                                                    <p className="flex items-center gap-1 text-slate-700 truncate" title={`${v.destination_port}, ${v.destination_country}`}>
                                                        <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" /> {v.destination_port}, {v.destination_country}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 border-t sm:border-t-0 border-slate-100 pt-4 sm:pt-0 shrink-0">
                                            {uiStatus === 'ACTION_REQUIRED' ? (
                                                <a href={`/vehicles/${v.vin}`} className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                                                    Configure Services <ChevronRight size={16} />
                                                </a>
                                            ) : (
                                                <>
                                                    <p className="font-black text-xl text-slate-800">${Number(v.client_total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                                    <button className="text-blue-600 font-bold text-sm hover:underline">View Invoice</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Side Panel: Payments & Actions (Takes 1/3 width) */}
                <div className="space-y-8">

                    {/* Quick Actions */}
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-md p-6 text-white relative overflow-hidden transition-transform hover:-translate-y-1">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">Need to add a vehicle?</h3>
                            <p className="text-blue-100 text-sm mb-6 leading-relaxed">Notify MotorX of a new auction purchase to start the dispatch process.</p>
                            <button onClick={() => navigate('/vehicles/new')} className="bg-white text-blue-700 w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors shadow-sm">
                                <Plus size={18} /> Add Vehicle
                            </button>
                        </div>
                        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                            <Car size={140} />
                        </div>
                    </div>

                    {/* Recent Payments */}
                    <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl overflow-hidden flex flex-col h-[300px]">
                        <div className="p-5 border-b border-white/10 bg-white/30 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-slate-800">Recent Payments</h3>
                            <button className="text-blue-600 text-sm font-bold hover:underline">View All</button>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                            {recentPayments.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    No recent payments found.
                                </div>
                            ) : (
                                recentPayments.map((p, i) => (
                                    <div key={i} className="p-5 hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-bold text-slate-700">${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                            <span className="text-xs font-semibold text-slate-400">{p.date}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <p className="text-slate-500 font-medium">{p.method}</p>
                                            <p className="text-slate-400 font-mono text-[10px] tracking-wider bg-slate-100 px-2 py-0.5 rounded">REF: {p.ref}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>


        </div>
    );
}
