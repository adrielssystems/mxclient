"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, Car, CalendarDays, ChevronDown, Check } from 'lucide-react';
import { formatToMDY } from "@/utils/dateUtils";
import { formatCurrency } from "@/utils/formatUtils";

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

const StatusBadge = ({ label, colorClass, t }) => {
    // Attempt to translate the label if it matches our status keys, else display as is
    const translationKey = `status.${label.toLowerCase().replace(/ /g, '_')}`;
    const translatedLabel = t ? t(translationKey, { defaultValue: label }) : label;

    return (
        <span className={`px-1 py-0.5 text-[9px] font-black rounded border uppercase tracking-widest block text-center leading-tight ${colorClass}`}>
            {translatedLabel}
        </span>
    );
};

// --- MEMOIZED ROW COMPONENT ---
const VehicleRow = React.memo(({ vehicle, activeTab = 'All', t }) => {
    const isLate = vehicle.payment_status === 'late';

    // Purchase badge
    const isExternal = !(vehicle.dl_number === 'AR' || vehicle.dl_number === 'WI');
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
                <a href={`/vehicles/${vehicle.vin}/details`} className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline font-mono cursor-pointer transition-colors">
                    {vehicle.vin}
                </a>
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
                    <span className="text-[11px] font-black text-slate-900">{vehicle.purchase_price ? formatCurrency(vehicle.purchase_price) : "—"}</span>
                </div>
            </td>
            {/* Purchase Status */}
            { (activeTab === 'All' || activeTab === 'Purchases') && (
                <td className="px-2 py-1.5 w-[82px]">
                    <StatusBadge label={purchaseLabel} colorClass={purchaseColor} t={t} />
                </td>
            )}
            {/* Dispatch Status */}
            { (activeTab === 'All' || activeTab === 'Dispatch') && (
                <td className="px-2 py-1.5 w-[82px]">
                    {dispatchStatus
                        ? <StatusBadge label={dispatchStatus} colorClass={dispatchColor} t={t} />
                        : <span className="text-slate-200 text-[11px] block text-center">—</span>
                    }
                </td>
            )}
            {/* Title Service Status */}
            { (activeTab === 'All' || activeTab === 'Title SVC') && (
                <td className="px-2 py-1.5 w-[82px]">
                    {titleStatus
                        ? <StatusBadge label={titleStatus} colorClass={titleColor} t={t} />
                        : <span className="text-slate-200 text-[11px] block text-center">—</span>
                    }
                </td>
            )}
        </tr>
    );
});

export default function ClientVehiclesTable({ vehicles = [], activeTab = 'All' }) {
    const { t } = useTranslation();
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

    const uniqueClients = useMemo(() => {
        return [...new Set(vehicles.map(v => v.buyer_name).filter(Boolean))].sort();
    }, [vehicles]);

    // --- CLIENT-SIDE FILTER LOGIC ---
    const [clientFilter, setClientFilter] = useState([]);
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const clientDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
                setIsClientDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

            // 4. Client Filter (for main clients with sub-clients)
            if (clientFilter.length > 0 && !clientFilter.includes(v.buyer_name)) {
                return false;
            }

            // 5. Date Filter
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
    }, [vehicles, debouncedSearch, auctionFilter, locationFilter, clientFilter, startDate, endDate]);

    // --- PAGINATION LOGIC ---
    const totalCount = filteredVehicles.length;
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
    const paginatedVehicles = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredVehicles.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredVehicles, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, auctionFilter, locationFilter, clientFilter, startDate, endDate]);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
                {/* Search and Advanced Filters */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t('vehicles.search_label')}</label>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14} />
                            <input 
                                type="text" 
                                placeholder={t('vehicles.search_placeholder')}
                                className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Auction Filter */}
                    <div className="w-[160px]">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t('vehicles.auction')}</label>
                        <select 
                            value={auctionFilter}
                            onChange={(e) => setAuctionFilter(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        >
                            <option value="all">{t('vehicles.all_auctions')}</option>
                            {uniqueAuctions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>

                    {/* Location Filter */}

                    {/* Location Filter */}
                    <div className="w-[160px]">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t('vehicles.location')}</label>
                        <select 
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        >
                            <option value="all">{t('vehicles.all_locations')}</option>
                            {uniqueLocations.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    {/* Sub-Client Filter (Only visible if there are multiple clients) */}
                    {uniqueClients.length > 1 && (
                        <div className="w-[160px]" ref={clientDropdownRef}>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t('vehicles.clients')}</label>
                            <div className="relative">
                                <button
                                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold outline-none shadow-sm flex items-center justify-between hover:border-blue-500 transition-colors"
                                >
                                    <span className="truncate">
                                        {clientFilter.length === 0 
                                            ? t('vehicles.all_clients')
                                            : clientFilter.length === 1 
                                                ? clientFilter[0] 
                                                : `${clientFilter.length} ${t('vehicles.selected')}`}
                                    </span>
                                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isClientDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                                        <div 
                                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 border-b border-slate-100"
                                            onClick={() => setClientFilter([])}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${clientFilter.length === 0 ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                                {clientFilter.length === 0 && <Check size={10} className="text-white" />}
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-700">{t('vehicles.all_clients')}</span>
                                        </div>
                                        {uniqueClients.map(c => (
                                            <div 
                                                key={c}
                                                className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                                                onClick={() => {
                                                    setClientFilter(prev => 
                                                        prev.includes(c) 
                                                            ? prev.filter(item => item !== c)
                                                            : [...prev, c]
                                                    );
                                                }}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${clientFilter.includes(c) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                                                    {clientFilter.includes(c) && <Check size={10} className="text-white" />}
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-700 truncate" title={c}>{c}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Date Filters */}
                    <div className="flex gap-2 items-end">
                        {/* FROM */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t('vehicles.from')}</label>
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
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t('vehicles.to')}</label>
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
                            setDebouncedSearch("");
                            setAuctionFilter("all");
                            setLocationFilter("all");
                            setClientFilter([]);
                            setStartDate("");
                            setEndDate("");
                        }}
                        className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-lg transition-colors border border-slate-200"
                    >
                        {t('vehicles.reset')}
                    </button>
                </div>

                {/* Vehicles Table */}
                <div className="overflow-x-auto flex-1">
                    <table className="min-w-full divide-y divide-slate-200 table-fixed">
                        <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[150px]">{t('vehicles.col_vin')}</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[68px]">{t('vehicles.col_lot')}</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[190px]">{t('vehicles.col_description')}</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[160px]">{t('vehicles.col_auction_location')}</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[130px]">{t('vehicles.col_client')}</th>
                                <th className="px-2 py-2 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[95px]">{t('vehicles.col_date_price')}</th>
                                { (activeTab === 'All' || activeTab === 'Purchases') && (
                                    <th className="px-2 py-2 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest w-[82px]">{t('vehicles.col_purchase')}</th>
                                )}
                                { (activeTab === 'All' || activeTab === 'Dispatch') && (
                                    <th className="px-2 py-2 text-center text-[10px] font-black text-blue-500 uppercase tracking-widest w-[82px]">{t('vehicles.col_dispatch')}</th>
                                )}
                                { (activeTab === 'All' || activeTab === 'Title SVC') && (
                                    <th className="px-2 py-2 text-center text-[10px] font-black text-violet-500 uppercase tracking-widest w-[82px]">{t('vehicles.col_title_svc')}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {paginatedVehicles.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-24 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="h-8 w-8 text-slate-300" />
                                            <p className="font-medium">{t('vehicles.no_vehicles')}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedVehicles.map((vehicle) => (
                                    <VehicleRow key={vehicle.vin || vehicle.id} vehicle={vehicle} activeTab={activeTab} t={t} />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-slate-500 text-center sm:text-left">
                            {t('vehicles.showing')} <span className="font-bold text-slate-900">{totalCount > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0}</span> {t('vehicles.to_lowercase')} <span className="font-bold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}</span> {t('vehicles.of')} <span className="font-bold text-slate-900">{totalCount}</span> {t('vehicles.vehicles_lowercase')}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {t('actions.previous')}
                            </button>
                            <div className="flex items-center px-4 text-sm font-bold text-slate-600">
                                {t('actions.page_x_of_y', { current: currentPage, total: totalPages })}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {t('actions.next')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
