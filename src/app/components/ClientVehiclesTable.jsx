"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Car, CalendarDays, Check, Copy } from 'lucide-react';
import { formatToMDY } from "@/utils/dateUtils";

// --- COPY VIN HELPER ---
const CopyVin = ({ vin }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(vin);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={handleCopy} className="ml-1 text-slate-400 hover:text-blue-500 transition-colors" title="Copy VIN">
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
        </button>
    );
};

// --- STATUS COLOR HELPERS ---
const PURCHASE_COLORS = {
    late:            'bg-red-100 text-red-800 border-red-200',
    paid:            'bg-green-100 text-green-800 border-green-200',
    payment_pending: 'bg-amber-100 text-amber-800 border-amber-200',
    default:         'bg-slate-100 text-slate-600 border-slate-200',
};
const DISPATCH_COLORS = {
    'Completed':  'bg-green-100 text-green-800 border-green-200',
    'In Transit': 'bg-blue-100 text-blue-800 border-blue-200',
    'Today':      'bg-sky-100 text-sky-800 border-sky-200',
    'Late':       'bg-red-100 text-red-800 border-red-200',
    'INVOICE':    'bg-purple-100 text-purple-800 border-purple-200',
    'Pending':    'bg-slate-100 text-slate-500 border-slate-200',
    'New':        'bg-slate-100 text-slate-500 border-slate-200',
};
const TITLE_COLORS = {
    'Completed':  'bg-green-100 text-green-800 border-green-200',
    'NOT PAID':   'bg-red-100 text-red-800 border-red-200',
    'INVOICE':    'bg-violet-100 text-violet-800 border-violet-200',
    'Received':   'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Mailing IN': 'bg-sky-100 text-sky-800 border-sky-200',
    'Approved':   'bg-blue-100 text-blue-800 border-blue-200',
    'Requested':  'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Canceled':   'bg-slate-100 text-slate-400 border-slate-200',
    'New':        'bg-slate-100 text-slate-400 border-slate-200',
};

const StatusBadge = ({ label, colorClass }) => (
    <span className={`px-1 py-0.5 text-[9px] font-black rounded border uppercase tracking-widest block text-center leading-tight ${colorClass}`}>
        {label}
    </span>
);

// --- MEMOIZED ROW COMPONENT ---
const VehicleRow = React.memo(({ vehicle }) => {
    const isLate = vehicle.payment_status === 'late';

    // Purchase badge
    const isExternal = vehicle.purchase_source === 'External';
    const purchaseColor = isExternal 
        ? PURCHASE_COLORS.default 
        : isLate
            ? PURCHASE_COLORS.late
            : vehicle.purchase_status === 'paid'
                ? PURCHASE_COLORS.paid
                : vehicle.purchase_status === 'payment_pending'
                    ? PURCHASE_COLORS.payment_pending
                    : PURCHASE_COLORS.default;
    const purchaseLabel = isExternal ? 'External' : isLate ? 'Late' : vehicle.purchase_status === 'paid' ? 'Paid' : vehicle.purchase_status === 'payment_pending' ? 'Invoiced' : (vehicle.purchase_status || '—');

    // Dispatch badge
    const dispatchStatus = vehicle.dispatch_display_status;
    const dispatchColor  = DISPATCH_COLORS[dispatchStatus] || DISPATCH_COLORS['New'];

    // Title Service badge
    const titleStatus = vehicle.title_service_status;
    const titleColor  = TITLE_COLORS[titleStatus] || 'bg-violet-50 text-violet-600 border-violet-200';

    return (
        <tr className={isLate ? "hover:bg-red-50 bg-red-50/50 transition-colors group border-b border-red-100 last:border-0" : "hover:bg-slate-50 transition-colors group border-b border-slate-100 last:border-0"}>
            {/* VIN */}
            <td className="px-2 py-1.5 w-[150px] whitespace-nowrap">
                <div className="flex items-center gap-1 group/vin">
                    <span className="text-[11px] font-bold text-slate-900 font-mono">{vehicle.vin}</span>
                    <CopyVin vin={vehicle.vin} />
                </div>
            </td>
            {/* Lot # */}
            <td className="px-2 py-1.5 w-[68px] text-[11px] text-slate-500 font-mono whitespace-nowrap">
                {vehicle.lot_number || "—"}
            </td>
            {/* Description */}
            <td className="px-2 py-1.5 w-[190px] max-w-[190px] truncate text-[11px] font-bold text-slate-700" title={vehicle.description}>
                {vehicle.description ? vehicle.description.replace(/\s*\([^)]*\)\s*/g, '').trim() : "—"}
            </td>
            {/* Auction / Location */}
            <td className="px-2 py-1.5 w-[160px]">
                <div className="flex flex-col leading-tight">
                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">{vehicle.auction_name || "N/A"}</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider truncate max-w-[150px]">{vehicle.auction_location || "—"}</span>
                </div>
            </td>
            {/* Client */}
            <td className="px-2 py-1.5 w-[130px]">
                <div className="flex flex-col leading-tight">
                    <span className="text-[11px] text-slate-700 font-bold truncate max-w-[120px]">{vehicle.buyer_name || "—"}</span>
                </div>
            </td>
            {/* Date + Price */}
            <td className="px-2 py-1.5 w-[95px] whitespace-nowrap">
                <div className="flex flex-col leading-tight">
                    <span className="text-[10px] text-slate-400 font-medium">{formatToMDY(vehicle.purchase_date)}</span>
                    <span className="text-[11px] font-black text-slate-900">{vehicle.purchase_price ? `$${parseFloat(vehicle.purchase_price).toLocaleString()}` : "—"}</span>
                </div>
            </td>
            {/* Purchase Status */}
            <td className="px-2 py-1.5 w-[82px]">
                <StatusBadge label={purchaseLabel} colorClass={purchaseColor} />
            </td>
            {/* Dispatch Status */}
            <td className="px-2 py-1.5 w-[82px]">
                {dispatchStatus
                    ? <StatusBadge label={dispatchStatus} colorClass={dispatchColor} />
                    : <span className="text-slate-200 text-[11px] block text-center">—</span>
                }
            </td>
            {/* Title Service Status */}
            <td className="px-2 py-1.5 w-[82px]">
                {titleStatus
                    ? <StatusBadge label={titleStatus} colorClass={titleColor} />
                    : <span className="text-slate-200 text-[11px] block text-center">—</span>
                }
            </td>
        </tr>
    );
});

export default function ClientVehiclesTable({ vehicles = [] }) {
    const startPickerRef = useRef(null);
    const endPickerRef   = useRef(null);

    // Helper: YYYY-MM-DD (native picker) → MM/DD/YYYY (display)
    const isoToMDY = (iso) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${m}/${d}/${y}`;
    };

    const [localSearch, setLocalSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState(localSearch);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(localSearch), 300);
        return () => clearTimeout(timer);
    }, [localSearch]);

    const [auctionFilter, setAuctionFilter] = useState("all");
    const [locationFilter, setLocationFilter] = useState("all");
    const [startDate, setStartDate] = useState(""); // MM/DD/YYYY
    const [endDate, setEndDate] = useState("");   // MM/DD/YYYY
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // --- OPTIMIZED DERIVED LISTS ---
    const uniqueAuctions = useMemo(() => {
        return [...new Set(vehicles.map(v => v.auction_name).filter(Boolean))].sort();
    }, [vehicles]);

    const uniqueLocations = useMemo(() => {
        return [...new Set(vehicles.map(v => v.auction_location).filter(Boolean))].sort();
    }, [vehicles]);

    // --- CLIENT-SIDE FILTER LOGIC ---
    const filteredVehicles = useMemo(() => {
        return vehicles.filter(v => {
            // 1. Search Filter (VIN, LOT, DESC)
            if (debouncedSearch) {
                const term = debouncedSearch.toLowerCase();
                const matchSearch = 
                    (v.vin || "").toLowerCase().includes(term) ||
                    (v.lot_number || "").toLowerCase().includes(term) ||
                    (v.description || "").toLowerCase().includes(term);
                if (!matchSearch) return false;
            }

            // 2. Auction Filter
            if (auctionFilter !== "all" && v.auction_name !== auctionFilter) {
                return false;
            }

            // 3. Location Filter
            if (locationFilter !== "all" && v.auction_location !== locationFilter) {
                return false;
            }

            // 4. Date Filter
            if (startDate || endDate) {
                const pDate = new Date(v.purchase_date);
                if (!isNaN(pDate)) {
                    if (startDate) {
                        const sDate = new Date(startDate);
                        if (pDate < sDate) return false;
                    }
                    if (endDate) {
                        const eDate = new Date(endDate);
                        if (pDate > eDate) return false;
                    }
                }
            }

            return true;
        });
    }, [vehicles, debouncedSearch, auctionFilter, locationFilter, startDate, endDate]);

    // --- PAGINATION LOGIC ---
    const totalCount = filteredVehicles.length;
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
    const paginatedVehicles = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredVehicles.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredVehicles, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, auctionFilter, locationFilter, startDate, endDate]);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                {/* Search and Advanced Filters */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Search (VIN, Lot, Desc)</label>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                            <input 
                                type="text" 
                                placeholder="Search vehicles..." 
                                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Auction Filter */}
                    <div className="w-[160px]">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Auction</label>
                        <select 
                            value={auctionFilter}
                            onChange={(e) => setAuctionFilter(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        >
                            <option value="all">All Auctions</option>
                            {uniqueAuctions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>

                    {/* Location Filter */}
                    <div className="w-[160px]">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Location</label>
                        <select 
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        >
                            <option value="all">All Locations</option>
                            {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="flex gap-2 items-end">
                        {/* FROM */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">From</label>
                            <div className="relative flex items-center">
                                <input 
                                    type="text"
                                    placeholder="MM/DD/YYYY"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    maxLength={10}
                                    className="w-[110px] pl-2 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm placeholder:text-slate-300"
                                />
                                {/* Hidden native picker triggered by icon */}
                                <input
                                    ref={startPickerRef}
                                    type="date"
                                    className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                                    onChange={(e) => setStartDate(isoToMDY(e.target.value))}
                                />
                                <button
                                    type="button"
                                    onClick={() => startPickerRef.current?.showPicker()}
                                    className="absolute right-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                                    title="Pick date"
                                >
                                    <CalendarDays size={13} />
                                </button>
                            </div>
                        </div>
                        {/* TO */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">To</label>
                            <div className="relative flex items-center">
                                <input 
                                    type="text"
                                    placeholder="MM/DD/YYYY"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    maxLength={10}
                                    className="w-[110px] pl-2 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm placeholder:text-slate-300"
                                />
                                <input
                                    ref={endPickerRef}
                                    type="date"
                                    className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
                                    onChange={(e) => setEndDate(isoToMDY(e.target.value))}
                                />
                                <button
                                    type="button"
                                    onClick={() => endPickerRef.current?.showPicker()}
                                    className="absolute right-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                                    title="Pick date"
                                >
                                    <CalendarDays size={13} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Reset Button */}
                    <button 
                        onClick={() => {
                            setLocalSearch("");
                            setAuctionFilter("all");
                            setLocationFilter("all");
                            setStartDate("");
                            setEndDate("");
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                    >
                        Reset
                    </button>
                </div>

                {/* Vehicles Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="min-w-full divide-y divide-slate-200 table-fixed">
                        <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[150px]">VIN</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[68px]">Lot #</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[190px]">Description</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[160px]">Auction / Location</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[130px]">Client</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[95px]">Date / Price</th>
                                <th className="px-2 py-2 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest w-[82px]">Purchase</th>
                                <th className="px-2 py-2 text-center text-[10px] font-black text-blue-500 uppercase tracking-widest w-[82px]">Dispatch</th>
                                <th className="px-2 py-2 text-center text-[10px] font-black text-violet-500 uppercase tracking-widest w-[82px]">Title Svc</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {paginatedVehicles.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-24 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="h-8 w-8 text-slate-300" />
                                            <p className="font-medium">No vehicles found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedVehicles.map((vehicle) => (
                                    <VehicleRow key={vehicle.vin || vehicle.id} vehicle={vehicle} />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            Showing <span className="font-bold text-slate-900">{totalCount > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> of <span className="font-bold text-slate-900">{totalCount}</span> vehicles
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Previous
                            </button>
                            <div className="flex items-center px-4 text-sm font-bold text-slate-600">
                                Page {currentPage} of {totalPages}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
