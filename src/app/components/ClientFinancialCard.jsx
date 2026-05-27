import React from 'react';
import { DollarSign, FileText } from 'lucide-react';

export default function ClientFinancialCard({ vehicle, pendingFees = [] }) {
    if (!vehicle) return null;

    const fmt = (val) => `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const totalPending = pendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
    const estimatedTotal = Number(vehicle.client_total_price || 0) + totalPending;

    return (
        <div className="bg-white rounded-xl h-full flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <DollarSign size={16} className="text-green-500" /> Financial Summary
                    </h3>
                </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-center py-1 border-b border-slate-100">
                        <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Purchase Base</span>
                        <span className="font-bold text-slate-700 text-sm">{fmt(vehicle.client_base_price)}</span>
                    </div>

                    {pendingFees.length > 0 && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300">
                            <p className="font-bold text-[9px] text-emerald-600 uppercase tracking-widest">Pending Configuration</p>
                            {pendingFees.map((fee, idx) => (
                                <div key={idx} className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 font-medium">{fee.label}</span>
                                    <span className="text-[10px] text-emerald-600 font-bold">+ {fmt(fee.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-2 pb-1 border-t-2 border-slate-900/5 mt-2">
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">
                                {pendingFees.length > 0 ? 'Estimated Total' : 'Total Balance Due'}
                            </span>
                            {pendingFees.length > 0 && (
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter bg-emerald-50 px-1 rounded w-fit mt-0.5">Estimated</span>
                            )}
                        </div>
                        <span className={`font-black text-lg transition-colors ${pendingFees.length > 0 ? 'text-slate-900' : 'text-red-600'}`}>
                            {fmt(estimatedTotal)}
                        </span>
                    </div>

                    <div className="pt-3 text-center">
                        <p className="text-[10px] text-slate-400 leading-tight">
                            Includes base purchase price, auction fees, and applicable transport logistics based on your configuration.
                        </p>
                    </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                    <button className="w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg font-bold text-xs shadow-sm transition-transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                        <FileText size={16} /> View Official Invoice
                    </button>
                    <p className="text-[9px] text-center text-slate-400 mt-1.5 font-medium uppercase tracking-tight">Download PDF for your records</p>
                </div>
            </div>
        </div>
    );
}
