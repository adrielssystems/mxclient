"use client";
import React, { useState } from "react";
import { Search, Filter, ChevronDown, ChevronUp, Car, Ship, Gavel, Package, Truck, CheckCircle } from "lucide-react";
import { formatToMDY } from "@/utils/dateUtils";

// ── Logistics pipeline steps (Client View) ──────────────────────────────────
const PIPELINE = [
    { key: "purchased", label: "Purchased", icon: Gavel },
    { key: "dispatched", label: "Dispatch", icon: Truck },
    { key: "at_terminal", label: "Terminal", icon: Package },
    { key: "in_transit", label: "Shipping", icon: Ship },
    { key: "delivered", label: "Delivered", icon: CheckCircle },
];

const STATUS_STEP = {
    purchased: 0, entered: 0, payment_pending: 0,
    dispatched: 1, in_transit: 1, assignment_pending: 1, picked_up: 1,
    at_terminal: 2, at_warehouse: 2,
    booked: 3, loaded: 3, in_transit_ocean: 3,
    arrived: 4, customs_cleared: 4, delivered: 4,
};

const PAY_CONFIG = {
    paid: { label: "Paid", cls: "bg-green-100 text-green-800 border-green-200" },
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    payment_pending: { label: "Pending", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    late: { label: "Late", cls: "bg-red-100 text-red-800 border-red-200" },
    unpaid: { label: "Unpaid", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    not_applicable: { label: "N/A", cls: "bg-slate-50 text-slate-400 border-slate-100" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtStatus = (s) => (s || "").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

// ── Client Vehicle Card (Read-Only) ──────────────────────────────────────────
function ClientVehicleCard({ vehicle, isExpanded, onToggle }) {
    const step = STATUS_STEP[vehicle.current_status] ?? 0;
    const rawPaymentStatus = typeof vehicle.payment_status === 'string' ? vehicle.payment_status.toLowerCase() : 'unpaid';
    const payConf = PAY_CONFIG[rawPaymentStatus] || PAY_CONFIG.unpaid;

    // Helper for status background
    const getStatusBadge = (statusGroup) => {
        // Group statuses into the UI categories requested by the user
        const status = statusGroup || '';
        const uiStatus = ['purchased', 'entered', 'assignment_pending'].includes(status) ? 'ACTION_REQUIRED' : 
            ['dispatched', 'in_transit', 'booked', 'loaded', 'in_transit_ocean', 'at_terminal'].includes(status) ? 'IN_TRANSIT' : 
            ['arrived', 'customs_cleared', 'delivered'].includes(status) ? 'DELIVERED' : status.toUpperCase();
        
        switch (uiStatus) {
            case 'ACTION_REQUIRED': return "bg-orange-100 text-orange-700";
            case 'IN_TRANSIT': return "bg-blue-100 text-blue-700";
            case 'DELIVERED': return "bg-emerald-100 text-emerald-700";
            default: return "bg-slate-100 text-slate-700";
        }
    };
    const statusBgClass = getStatusBadge(vehicle.current_status);

    return (
        <div className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${isExpanded ? "border-blue-300 shadow-md" : "border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"}`}>

            {/* Header */}
            <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-center gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <Car size={20} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-slate-900 text-sm leading-tight">{vehicle.vin}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                    </p>
                </div>

                <span className={`flex-shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-full border uppercase tracking-wider ${payConf.cls}`}>
                    {payConf.label}
                </span>

                <span className="flex-shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
            </button>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5 animate-in fade-in duration-200">

                    {/* Pipeline */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Transport Progress</p>
                        <div className="flex items-center gap-0">
                            {PIPELINE.map((stage, i) => {
                                const done = i < step;
                                const active = i === step;
                                return (
                                    <React.Fragment key={stage.key}>
                                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all
                                                ${done ? "bg-blue-600 border-blue-600 text-white" :
                                                    active ? "bg-blue-50 border-blue-500 text-blue-600" :
                                                        "bg-slate-50 border-slate-200 text-slate-400"}`}>
                                                <stage.icon size={16} />
                                            </div>
                                            <span className={`text-[10px] font-bold text-center leading-tight max-w-[52px] ${active ? "text-blue-600" : done ? "text-blue-500" : "text-slate-400"}`}>
                                                {stage.label}
                                            </span>
                                        </div>
                                        {i < PIPELINE.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${done ? "bg-blue-500" : "bg-slate-200"}`} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Standard details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        {[
                            { label: "Auction", value: vehicle.auction_name || "—" },
                            { label: "Port", value: vehicle.destination_port || "—" },
                            { label: "Destination", value: vehicle.destination_country || "—" },
                            { label: "Purchase Date", value: vehicle.purchase_date ? formatToMDY(vehicle.purchase_date) : "—" },
                            { label: "Current Status", value: fmtStatus(vehicle.current_status) },
                        ].map((item) => (
                            <div key={item.label} className="bg-slate-50 rounded-lg p-2.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                                {item.label === 'Current Status' ? (
                                    <div className="mt-1">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBgClass}`}>
                                            {item.value}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{item.value}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-4">
                            <div className="flex-1">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">Financial Summary</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Price</p>
                                        <p className="text-sm font-bold text-slate-700">{fmt(vehicle.client_base_price)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transport Fees</p>
                                        <p className="text-sm font-bold text-slate-700">{fmt(vehicle.transport_fees_total)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Price</p>
                                        <p className="text-sm font-bold text-slate-900">{fmt(vehicle.client_total_price)}</p>
                                    </div>
                                    <div className="text-right border-l border-slate-200 pl-4">
                                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Balance Due</p>
                                        <p className="text-base font-black text-red-600">{fmt(vehicle.total_due)}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Button */}
                            <div className="flex items-center sm:border-l sm:border-slate-200 sm:pl-6">
                                {['purchased', 'entered', 'assignment_pending'].includes(vehicle.current_status) ? (
                                    <a 
                                        href={`/vehicles/${vehicle.vin}`}
                                        className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider shadow-sm transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        Configure Services
                                    </a>
                                ) : (
                                    <a 
                                        href={`/vehicles/${vehicle.vin}`}
                                        className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider shadow-sm transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 whitespace-nowrap"
                                    >
                                        View Details
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── List Component ───────────────────────────────────────────────────────────
export default function ClientVehiclesTable({ vehicles = [] }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [expandedVin, setExpandedVin] = useState(null);

    const filtered = vehicles.filter(v => {
        const term = searchTerm.toLowerCase();
        const matchSearch =
            (v.vin || "").toLowerCase().includes(term) ||
            (v.make || "").toLowerCase().includes(term) ||
            (v.model || "").toLowerCase().includes(term);

        const matchStatus = statusFilter === "all" || v.current_status === statusFilter;
        return matchSearch && matchStatus;
    });

    return (
        <div className="space-y-5">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search by VIN, Make, Model…"
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full sm:w-auto pl-10 pr-8 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white shadow-sm"
                    >
                        <option value="all">All Statuses</option>
                        <option value="purchased">Purchased</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="at_terminal">At Terminal</option>
                        <option value="in_transit">In Transit / Ocean</option>
                        <option value="delivered">Delivered</option>
                    </select>
                </div>
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center">
                    <Car className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">
                        {searchTerm ? "No vehicles match your search." : "You have no vehicles yet."}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(v => (
                        <ClientVehicleCard
                            key={v.vin}
                            vehicle={v}
                            isExpanded={expandedVin === v.vin}
                            onToggle={() => setExpandedVin(expandedVin === v.vin ? null : v.vin)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
