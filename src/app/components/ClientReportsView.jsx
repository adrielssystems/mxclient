"use client";
import React, { useState, useEffect, lazy, Suspense } from "react";
import useUser from "@/utils/useUser";
import { formatCurrency } from "@/utils/formatUtils";
const ReportCharts = lazy(() => import("../reports/components/ReportCharts"));
import { FileText, Car, DollarSign, TrendingUp, AlertCircle, Search, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ClientReportsView({ hideHeader = false }) {
    const { data: user, loading: userLoading } = useUser();
    const { t } = useTranslation();
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

    // --- KPI Calculations ---

    // NOT PAID: Purchase invoice pending or late (Excluding External vehicles as they don't have purchase invoices)
    // purchase_status in DB: 'paid', 'payment_pending', 'late', 'not_applicable', 'unpaid'
    const notPaidVehicles = (vehicleHistory || []).filter(v => {
        const isMotorXDealer = v.dl_number === 'AR' || v.dl_number === 'WI';
        if (!isMotorXDealer) return false;

        const payStatus = (v.payment_status || '').toLowerCase();
        const currStatus = (v.current_status || '').toLowerCase();
        if (payStatus === 'paid' || payStatus === 'canceled' || currStatus === 'canceled') return false;

        const ps = (v.purchase_status || '').toLowerCase();
        // 'payment_pending' = has invoice but not yet paid, 'late' = overdue
        return ps === 'payment_pending' || ps === 'late' || ps === 'unpaid';
    });

    // TITLES RECEIVED: title from vehicle_title_services is 'Received' OR title_log has date_received
    const titlesReceivedVehicles = (vehicleHistory || []).filter(v =>
        v.title_service_status === 'Received' || v.title_log_status === 'Received'
    );

    // TITLE SVC (Active): title service in progress (not completed, not canceled)
    const activeTitleSvcVehicles = (vehicleHistory || []).filter(v =>
        v.title_service_status &&
        !['Completed', 'Canceled', 'NOT PAID'].includes(v.title_service_status)
    );

    // RELIST DANGER: >= 7 days since purchase AND $0 paid (using vehicles.amount_paid — same as Purchase Board)
    const relistDangerAll = (vehicleHistory || []).filter(v => {
        // Use vehicles.amount_paid (raw) — matches Purchase Board display
        const vehiclesAmountPaid = parseFloat(v.vehicles_amount_paid) || 0;
        const payStatus = (v.payment_status || '').toLowerCase();
        const currStatus = (v.current_status || '').toLowerCase();
        
        // Exclude already paid or canceled vehicles
        if (payStatus === 'paid' || payStatus === 'canceled' || currStatus === 'canceled') return false;

        let daysSince = 0;
        if (v.purchase_date) {
            const pDate = new Date(v.purchase_date);
            const now = new Date();
            daysSince = Math.floor((now - pDate) / (1000 * 60 * 60 * 24));
        }
        
        return daysSince >= 7 && vehiclesAmountPaid === 0;
    });

    // Filter Relist Danger table by search
    const filteredRelist = relistDangerAll.filter(v => {
        if (!searchFilter) return true;
        const term = searchFilter.toLowerCase();
        return (
            v.vin?.toLowerCase().includes(term) ||
            v.description?.toLowerCase().includes(term) ||
            v.auction_name?.toLowerCase().includes(term) ||
            v.lot_number?.toLowerCase().includes(term)
        );
    });

    return (
        <div className="font-sans animate-in fade-in duration-300 space-y-8">
            {/* Header */}
            {!hideHeader && (
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="text-blue-600" /> {t('dashboard.overview_analytics')}
                    </h1>
                    <p className="text-slate-500 mt-1">
                        {isMainClient ? t('dashboard.overview_desc_main') : t('dashboard.overview_desc')}
                    </p>
                </div>
            )}

            {/* KPI Cards — Row 1: Operational metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* NOT PAID */}
                <div className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all ${notPaidVehicles.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.not_paid')}</p>
                    <h2 className={`text-2xl font-black ${notPaidVehicles.length > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{notPaidVehicles.length}</h2>
                    <p className="text-[9px] text-slate-400 mt-0.5">{t('dashboard.not_paid_desc')}</p>
                    <DollarSign className={`mt-2 ${notPaidVehicles.length > 0 ? 'text-amber-500' : 'text-slate-300'}`} size={20} />
                </div>

                {/* TITLES RECEIVED */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.titles_received')}</p>
                    <h2 className="text-2xl font-black text-slate-800">{titlesReceivedVehicles.length}</h2>
                    <p className="text-[9px] text-slate-400 mt-0.5">{t('dashboard.titles_received_desc')}</p>
                    <CheckCircle2 className="text-emerald-500 mt-2" size={20} />
                </div>

                {/* TITLE SVC (Active) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.title_svc_active')}</p>
                    <h2 className="text-2xl font-black text-slate-800">{activeTitleSvcVehicles.length}</h2>
                    <p className="text-[9px] text-slate-400 mt-0.5">{t('dashboard.title_svc_active_desc')}</p>
                    <FileText className="text-violet-500 mt-2" size={20} />
                </div>

                {/* RELIST DANGER */}
                <div className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all ${relistDangerAll.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${relistDangerAll.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>{t('dashboard.relist_danger')}</p>
                    <h2 className={`text-2xl font-black ${relistDangerAll.length > 0 ? 'text-red-700' : 'text-slate-800'}`}>{relistDangerAll.length}</h2>
                    <p className="text-[9px] text-slate-400 mt-0.5">{t('dashboard.relist_danger_desc')}</p>
                    <AlertCircle className={`mt-2 ${relistDangerAll.length > 0 ? 'text-red-500' : 'text-slate-300'}`} size={20} />
                </div>
            </div>

            {/* KPI Cards — Row 2: Financial summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.total_vehicles')}</p>
                    <h2 className="text-2xl font-black text-slate-800">{kpis.totalVehicles}</h2>
                    <Car className="text-blue-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.total_invoiced')}</p>
                    <h2 className="text-2xl font-black text-slate-800">{formatCurrency(kpis.totalInvoiced)}</h2>
                    <FileText className="text-blue-500 mt-2" size={20} />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.total_paid')}</p>
                    <h2 className="text-2xl font-black text-emerald-700">{formatCurrency(kpis.totalPaid)}</h2>
                    <DollarSign className="text-emerald-500 mt-2" size={20} />
                </div>
                <div className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all ${kpis.outstandingBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('dashboard.outstanding')}</p>
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
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t('dashboard.loading_analytics')}</span>
                    </div>
                </div>
            }>
                <ReportCharts
                    statusDistribution={statusDistribution}
                    monthlySpending={monthlySpending}
                />
            </Suspense>

            {/* Relist Danger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-red-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h3 className="text-sm font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
                            <AlertCircle size={16} /> {t('dashboard.relist_danger_table')} ({filteredRelist.length})
                        </h3>
                        <p className="text-[11px] text-red-400 mt-0.5">{t('dashboard.relist_danger_table_desc')}</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('dashboard.search_placeholder')}
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.col_auction')}</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.col_description')}</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.col_vin')}</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.col_lot')}</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.col_purchase_price')}</th>
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('dashboard.col_days_since_purchase')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRelist.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                                        <CheckCircle2 className="mx-auto mb-2 text-emerald-300" size={28} />
                                        {t('dashboard.no_vehicles_relist')}
                                    </td>
                                </tr>
                            ) : (
                                filteredRelist.map((v, i) => {
                                    let daysSince = 0;
                                    if (v.purchase_date) {
                                        const pDate = new Date(v.purchase_date);
                                        const now = new Date();
                                        daysSince = Math.floor((now - pDate) / (1000 * 60 * 60 * 24));
                                    }
                                    const isDanger = daysSince > 7;

                                    return (
                                        <tr key={v.vin || i} className="hover:bg-red-50/30 transition-colors">
                                            <td className="px-5 py-4 text-slate-600 whitespace-nowrap font-medium">{v.auction_name || "–"}</td>
                                            <td className="px-5 py-4 font-bold text-slate-800 whitespace-nowrap">{v.description || "–"}</td>
                                            <td className="px-5 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">{v.vin}</td>
                                            <td className="px-5 py-4 text-slate-600 whitespace-nowrap font-mono text-xs">#{v.lot_number || "–"}</td>
                                            <td className="px-5 py-4 text-slate-900 font-black whitespace-nowrap">
                                                {formatCurrency(v.purchase_price || 0)}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {v.purchase_date ? (
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isDanger ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {isDanger && <AlertCircle size={12} />}
                                                        {daysSince}d
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">–</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
