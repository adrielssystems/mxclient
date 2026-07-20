"use client";
import React, { useState, useEffect, lazy, Suspense } from "react";
import useUser from "@/utils/useUser";
import { formatCurrency } from "@/utils/formatUtils";
const ReportCharts = lazy(() => import("../reports/components/ReportCharts"));
import { FileText, Car, DollarSign, TrendingUp, Truck, AlertCircle, Search, Loader2, CheckCircle2 } from "lucide-react";

const STATUS_LABELS = {
    purchased: "Purchased",
    entered: "Entered",
    assignment_pending: "Assignment Pending",
    dispatched: "Dispatched",
    in_transit: "In Transit",
    booked: "Booked",
    loaded: "Loaded",
    at_terminal: "At Terminal",
    in_transit_ocean: "In Transit (Ocean)",
    arrived: "Arrived",
    customs_cleared: "Customs Cleared",
    delivered: "Delivered",
    canceled: "Canceled"
};

export default function ClientReportsView({ hideHeader = false }) {
    const { data: user, loading: userLoading } = useUser();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchFilter, setSearchFilter] = useState("");

    useEffect(() => {
        if (!user) return;
        fetch("/api/client/reports", { cache: "no-store" })
            .then(r => r.ok ? r.json() : null)
            .then(d => setData(d))
            .catch(err => console.error("Reports fetch error:", err))
            .finally(() => setLoading(false));
    }, [user]);

    if (userLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-10 text-center text-slate-500">
                <AlertCircle className="mx-auto mb-3 text-slate-300" size={40} />
                <p>Failed to load reports data.</p>
            </div>
        );
    }

    const { kpis, monthlySpending, statusDistribution, vehicleHistory, isMainClient } = data;

    // Filter vehicles
    const filteredVehicles = (vehicleHistory || []).filter(v => {
        if (!searchFilter) return true;
        const term = searchFilter.toLowerCase();
        return (
            v.vin?.toLowerCase().includes(term) ||
            v.description?.toLowerCase().includes(term) ||
            v.auction_name?.toLowerCase().includes(term) ||
            v.buyer_name?.toLowerCase().includes(term)
        );
    });

    // Additional Logistics Metrics
    let notPaid = 0, titlesReceived = 0, activeDispatch = 0, activeTitleServices = 0;
    (vehicleHistory || []).forEach(v => {
        const pStatus = (v.purchase_status || '').toLowerCase();
        if (['new', 'pending', 'late', 'payment_pending'].includes(pStatus)) notPaid++;
        if (v.title_service_status === 'Received') titlesReceived++;
        if (v.title_service_status && v.title_service_status !== 'Completed' && v.title_service_status !== 'Canceled') activeTitleServices++;
        if (v.dispatch_display_status && ['New', 'In Transit', 'Today', 'Late', 'Pending'].includes(v.dispatch_display_status)) activeDispatch++;
    });

    return (
        <div className="font-sans animate-in fade-in duration-300 space-y-8">
            {/* Header */}
            {!hideHeader && (
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="text-blue-600" /> Reports & Analytics
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {isMainClient ? "Consolidated view including all sub-client activity." : "Your vehicle and financial activity summary."}
                    </p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* 4 New Logistics Cards from Vehicles page */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Not Paid</p>
                    <h2 className="text-2xl font-black text-slate-800">{notPaid}</h2>
                    <DollarSign className="text-red-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Titles Received</p>
                    <h2 className="text-2xl font-black text-slate-800">{titlesReceived}</h2>
                    <CheckCircle2 className="text-emerald-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Dispatch</p>
                    <h2 className="text-2xl font-black text-slate-800">{activeDispatch}</h2>
                    <Truck className="text-sky-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Title SVC (Active)</p>
                    <h2 className="text-2xl font-black text-slate-800">{activeTitleServices}</h2>
                    <FileText className="text-violet-500 mt-2" size={20} />
                </div>

                {/* Original 5 Financial/Status Cards */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Vehicles</p>
                    <h2 className="text-2xl font-black text-slate-800">{kpis.totalVehicles}</h2>
                    <Car className="text-blue-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active / In Transit</p>
                    <h2 className="text-2xl font-black text-slate-800">{kpis.activeInTransit}</h2>
                    <Truck className="text-amber-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Invoiced</p>
                    <h2 className="text-2xl font-black text-slate-800">{formatCurrency(kpis.totalInvoiced)}</h2>
                    <FileText className="text-blue-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
                    <h2 className="text-2xl font-black text-emerald-700">{formatCurrency(kpis.totalPaid)}</h2>
                    <DollarSign className="text-emerald-500 mt-2" size={20} />
                </div>
                <div className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all ${kpis.outstandingBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Outstanding</p>
                    <h2 className={`text-2xl font-black ${kpis.outstandingBalance > 0 ? 'text-red-700' : 'text-slate-800'}`}>
                        {formatCurrency(kpis.outstandingBalance)}
                    </h2>
                    <AlertCircle className={`mt-2 ${kpis.outstandingBalance > 0 ? 'text-red-400' : 'text-slate-300'}`} size={20} />
                </div>
            </div>

            {/* Charts Row */}
            <Suspense fallback={
                <div className="h-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Loader2 className="animate-spin" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Loading Analytics...</span>
                    </div>
                </div>
            }>
                <ReportCharts 
                    statusDistribution={statusDistribution} 
                    monthlySpending={monthlySpending} 
                />
            </Suspense>

            {/* Vehicle History Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">
                        Vehicle History ({filteredVehicles.length})
                    </h3>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search VIN, description..."
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">VIN</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description</th>
                                {isMainClient && <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Buyer</th>}
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Auction</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Destination</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">Purchase Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredVehicles.length === 0 ? (
                                <tr>
                                    <td colSpan={isMainClient ? 7 : 6} className="px-5 py-10 text-center text-slate-400">
                                        No vehicles match your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredVehicles.map((v, i) => (
                                    <tr key={v.vin || i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{v.vin}</td>
                                        <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{v.description || "-"}</td>
                                        {isMainClient && <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{v.buyer_name || "-"}</td>}
                                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{v.auction_name || "-"}</td>
                                        <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                                            {v.destination_port ? `${v.destination_port}, ${v.destination_country}` : "-"}
                                        </td>
                                        <td className="px-5 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                                                ${v.current_status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                                    v.current_status === 'canceled' ? 'bg-red-100 text-red-700' :
                                                        ['in_transit', 'dispatched', 'shipped', 'in_transit_ocean'].includes(v.current_status) ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                }`}>
                                                {STATUS_LABELS[v.current_status] || v.current_status?.replace(/_/g, " ") || "Unknown"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                                            {v.purchase_date ? new Date(v.purchase_date).toLocaleDateString("en-US") : "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
