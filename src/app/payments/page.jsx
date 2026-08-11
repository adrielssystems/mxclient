"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from 'sonner';
import { formatCurrency } from "@/utils/formatUtils";
import useUser from "@/utils/useUser";
import { CreditCard, FileText, CheckCircle, Search, Eye, CalendarDays, Filter } from "lucide-react";

export default function ClientPaymentsPage() {
    const { t } = useTranslation();
    const { data: user, loading } = useUser();
    const [payments, setPayments] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    // Filter states
    const [invoiceSearch, setInvoiceSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");

    // Memoized filters
    const filteredInvoices = useMemo(() => {
        if (!invoiceSearch) return invoices;
        const q = invoiceSearch.toLowerCase();
        return invoices.filter(inv => 
            String(inv.invoice_number).toLowerCase().includes(q) ||
            String(inv.vin || "").toLowerCase().includes(q) ||
            String(inv.lot_number || "").toLowerCase().includes(q)
        );
    }, [invoices, invoiceSearch]);

    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            let pass = true;
            if (startDate) {
                if (new Date(p.date) < new Date(startDate)) pass = false;
            }
            if (endDate) {
                if (new Date(p.date) > new Date(endDate)) pass = false;
            }
            if (minAmount) {
                if (Number(p.amount) < Number(minAmount)) pass = false;
            }
            if (maxAmount) {
                if (Number(p.amount) > Number(maxAmount)) pass = false;
            }
            return pass;
        });
    }, [payments, startDate, endDate, minAmount, maxAmount]);

    useEffect(() => {
        if (!user) return;
        fetch("/api/client/payments", { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { invoices: [], payments: [] })
            .then(d => {
                setInvoices(d.invoices || []);
                setPayments(d.payments || []);
            })
            .catch(err => console.error(err))
            .finally(() => setDataLoading(false));
    }, [user]);

    if (loading || dataLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="font-sans animate-in fade-in duration-300 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="text-blue-600" />
                    {t('payments.payments_and_invoices')}
                </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Invoices */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <FileText className="text-slate-500" size={20} />
                            <h3 className="font-bold text-slate-800">{t('payments.my_invoices')}</h3>
                        </div>
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                            <input
                                type="text"
                                placeholder={t('payments.search_invoice_placeholder')}
                                value={invoiceSearch}
                                onChange={(e) => setInvoiceSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[600px]">
                        {filteredInvoices.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">{t('payments.no_invoices_found')}</div>
                        ) : (
                            filteredInvoices.map(inv => (
                                <div key={inv.id} className="p-5 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-slate-800 text-lg">#{inv.invoice_number}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{new Date(inv.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <div className={`px-2 py-1 rounded-full text-xs font-bold shrink-0 ${inv.status.toLowerCase() === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {t(`status.${inv.status.toLowerCase()}`, { defaultValue: inv.status.replace(/_/g, ' ').toUpperCase() })}
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mt-4 gap-3">
                                        <div className="text-xs text-slate-500 font-medium">
                                            {inv.vin ? (
                                                <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                                                    <span className="text-slate-700">{inv.vin}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="truncate max-w-[200px]">{inv.vehicle_desc}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{t('payments.lot')} <span className="text-slate-700">{inv.lot_number || t('payments.n_a')}</span></span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{t('payments.client')} <span className="text-slate-700">{inv.client_name || t('payments.n_a')}</span></span>
                                                </div>
                                            ) : (
                                                t('payments.general_services')
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="font-black text-slate-800 text-lg">
                                                {formatCurrency(inv.amount)}
                                            </div>
                                            {inv.quickbooks_invoice_id && (
                                                <a 
                                                    href={`/api/integrations/quickbooks/invoice/${inv.quickbooks_invoice_id}/pdf`} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title={t('payments.view_pdf')}
                                                >
                                                    <Eye size={18} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Payments */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="text-slate-500" size={20} />
                            <h3 className="font-bold text-slate-800">{t('payments.payment_history')}</h3>
                        </div>
                            
                        <div className="flex flex-col gap-4 w-full">
                            <div className="flex flex-col gap-1.5 w-full">
                                <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><CalendarDays size={12}/> {t('payments.date_range')}</label>
                                <div className="flex items-center gap-2">
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                                    <span className="text-slate-300">-</span>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5 w-full">
                                <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1"><Filter size={12}/> {t('payments.amount_range')}</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" placeholder={t('payments.min')} value={minAmount} onChange={e => setMinAmount(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <span className="text-slate-300">-</span>
                                    <input type="number" placeholder={t('payments.max')} value={maxAmount} onChange={e => setMaxAmount(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[600px]">
                        {filteredPayments.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">{t('payments.no_payment_history')}</div>
                        ) : (
                            filteredPayments.map(p => (
                                <div key={p.id} className="p-5 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-slate-800 text-lg">{formatCurrency(p.amount)}</div>
                                        <div className="text-xs text-slate-500 font-medium">
                                            {new Date(p.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-sm text-slate-500">
                                            {t('payments.invoice_label')} <span className="font-semibold">#{p.invoice_number}</span>
                                        </div>
                                        <div className="flex items-center gap-3">

                                            {p.quickbooks_invoice_id && (
                                                <a 
                                                    href={`/api/integrations/quickbooks/invoice/${p.quickbooks_invoice_id}/pdf`} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title={t('payments.view_pdf')}
                                                >
                                                    <Eye size={16} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
