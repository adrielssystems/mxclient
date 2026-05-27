"use client";
import React, { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { CreditCard, FileText, CheckCircle } from "lucide-react";

export default function ClientPaymentsPage() {
    const { data: user, loading } = useUser();
    const [payments, setPayments] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

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
        <div className="font-sans animate-in fade-in duration-300 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="text-blue-600" />
                    Payments & Invoices
                </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Invoices */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                        <FileText className="text-slate-500" size={20} />
                        <h3 className="font-bold text-slate-800">My Invoices</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {invoices.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">No invoices found.</div>
                        ) : (
                            invoices.map(inv => (
                                <div key={inv.id} className="p-5 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-slate-800">{inv.invoice_number}</div>
                                        <div className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status.toLowerCase() === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {inv.status.replace(/_/g, ' ').toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-sm text-slate-500">
                                            {inv.vehicle_desc ? inv.vehicle_desc : 'General Services'}
                                            <div className="text-xs mt-1 text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <div className="font-black text-slate-800">
                                            ${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Payments */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                        <CheckCircle className="text-slate-500" size={20} />
                        <h3 className="font-bold text-slate-800">Payment History</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {payments.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">No payment history found.</div>
                        ) : (
                            payments.map(p => (
                                <div key={p.id} className="p-5 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-slate-800">${Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                        <div className="text-xs text-slate-500 font-medium">
                                            {new Date(p.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-sm text-slate-500">
                                            Invoice: <span className="font-semibold">{p.invoice_number}</span>
                                        </div>
                                        <div className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-mono">
                                            REF: {p.ref || 'N/A'}
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
