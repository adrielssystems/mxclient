"use client";
import React, { useState } from 'react';
import { DollarSign, FileText, CreditCard, Download, AlertCircle, Eye, Loader2, Ban } from 'lucide-react';
import { formatToMDY } from "@/utils/dateUtils";
import { formatCurrency } from "@/utils/formatUtils";

export default function ClientVehicleReadOnlyFinancials({ vehicle, invoices = [] }) {
    const [downloadingId, setDownloadingId] = useState(null);

    const handleDownloadPdf = async (qbId, invoiceNumber) => {
        setDownloadingId(qbId);
        try {
            const res = await fetch(`/api/integrations/quickbooks/invoice/${qbId}/pdf`);
            if (!res.ok) throw new Error('Failed to fetch PDF');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-${invoiceNumber || qbId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF download error:', err);
        } finally {
            setDownloadingId(null);
        }
    };

    // Calculate Ledger
    // Filter out void/canceled invoices
    const activeInvoices = invoices.filter(inv => {
        const s = (inv.status || '').toLowerCase();
        return !['void', 'canceled', 'cancelled', 'deleted'].includes(s);
    });

    const totalInvoiced = activeInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
    
    const totalBalance = activeInvoices.reduce((sum, inv) => {
        let bal = parseFloat(inv.balance);
        const amt = parseFloat(inv.amount) || 0;
        const status = (inv.status || 'draft').toLowerCase();

        if (isNaN(bal)) {
            // If balance is missing, infer from status
            bal = status === 'paid' ? 0 : amt;
        } else if (bal === 0 && (status === 'pending' || status === 'open' || status === 'draft')) {
            // If balance is 0 but status indicates it shouldn't be
            bal = amt;
        }
        return sum + bal;
    }, 0);

    const totalPaid = totalInvoiced - totalBalance;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-green-500" />
                    Financial Overview
                </h3>
            </div>

            {/* DO NOT PAY Warning Banner */}
            {vehicle?.do_not_pay && (
                <div className="mx-5 my-4 flex items-center gap-3 bg-orange-50 border-2 border-orange-400 text-orange-800 px-4 py-3 rounded-xl shadow-md">
                    <Ban className="w-5 h-5 text-orange-500 shrink-0" />
                    <div className="flex-1">
                        <p className="font-black text-[11px] uppercase tracking-widest">⚠ DO NOT PAY — Payment On Hold</p>
                        <p className="text-[10px] mt-0.5 font-medium">This vehicle has been flagged by administration. Please contact MotorX support for more details before making any payments.</p>
                    </div>
                </div>
            )}

            {/* LEDGER HEADER */}
            <div className="bg-slate-900 p-5 text-white">
                <div className="grid grid-cols-3 gap-4 text-center divide-x divide-slate-700">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Invoiced</div>
                        <div className="text-xl font-bold tracking-tight">{formatCurrency(totalInvoiced)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Paid</div>
                        <div className="text-xl font-bold text-green-400 tracking-tight">{formatCurrency(totalPaid)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">Balance</div>
                        <div className="text-xl font-bold text-yellow-400 tracking-tight">{formatCurrency(totalBalance)}</div>
                    </div>
                </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto w-full">
                {/* INVOICES LIST */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Invoices</h4>
                    </div>

                    <div className="space-y-3">
                        {(!invoices || invoices.length === 0) ? (
                            <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-400 font-medium mb-4">No invoices generated</p>
                            </div>
                        ) : (
                            invoices.map((inv, idx) => (
                                <div key={inv.id || idx} className="border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all bg-white group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono font-bold text-slate-900 text-sm bg-slate-100 px-1.5 py-0.5 rounded">#{inv.invoice_number || 'DRAFT'}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${inv.status === 'paid' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        inv.status === 'open' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            inv.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}>
                                                    {inv.status || 'Draft'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                <span className="text-slate-400">{formatToMDY(inv.created_at)}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="uppercase tracking-wider font-bold text-[10px] text-blue-600/80">
                                                    {inv.service_category === 'TITLE' ? 'Title Service' :
                                                     inv.service_category === 'DISPATCH' ? 'Dispatch' :
                                                     inv.service_category === 'SHIPPING' ? 'Shipping' :
                                                     inv.service_category === 'PURCHASE' ? 'Purchase' :
                                                     inv.service_category === 'DISMANTLING' ? 'Dismantling' :
                                                     (inv.service_category || 'Invoice')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-900 text-lg">{formatCurrency(inv.amount)}</div>
                                            {(() => {
                                                let bal = parseFloat(inv.balance);
                                                const amt = parseFloat(inv.amount) || 0;
                                                const status = (inv.status || 'draft').toLowerCase();
                                                
                                                if (isNaN(bal)) bal = status === 'paid' ? 0 : amt;
                                                else if (bal === 0 && (status === 'pending' || status === 'open' || status === 'draft')) bal = amt;

                                                if (bal > 0) {
                                                    return (
                                                        <div className="text-xs text-red-600 font-bold flex items-center justify-end gap-1 mt-0.5">
                                                            <AlertCircle className="h-3 w-3" />
                                                            Due: {formatCurrency(bal)}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    </div>

                                    {/* PDF Actions */}
                                    {inv.quickbooks_invoice_id && (
                                        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                                            <button
                                                onClick={() => window.open(`/api/integrations/quickbooks/invoice/${inv.quickbooks_invoice_id}/pdf`, '_blank')}
                                                className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-blue-600 transition-colors"
                                                title="View PDF"
                                            >
                                                <Eye className="h-3 w-3" />
                                                View
                                            </button>
                                            <button
                                                onClick={() => handleDownloadPdf(inv.quickbooks_invoice_id, inv.invoice_number)}
                                                disabled={downloadingId === inv.quickbooks_invoice_id}
                                                className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                                                title="Download PDF"
                                            >
                                                {downloadingId === inv.quickbooks_invoice_id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Download className="h-3 w-3" />
                                                )}
                                                PDF
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
