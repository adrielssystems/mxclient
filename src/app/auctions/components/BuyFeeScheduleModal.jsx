import React from 'react';
import { X, DollarSign } from 'lucide-react';
import { BUY_FEE_TIERS } from '@/utils/buyFeeCalculator';

export default function BuyFeeScheduleModal({ isOpen, onClose, currentAmount = 0 }) {
    if (!isOpen) return null;

    const numAmount = parseFloat(currentAmount) || 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col font-sans">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-motorx-red" />
                        Buy Fee Schedule
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Table */}
                <div className="max-h-[65vh] overflow-y-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 border-b border-slate-200 z-10">
                            <tr>
                                <th className="py-2.5 px-6">Purchase amount</th>
                                <th className="py-2.5 px-6 text-right">Buyer fee</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {BUY_FEE_TIERS.map((tier, idx) => {
                                const isCurrentTier = numAmount >= tier.min && numAmount <= tier.max;
                                return (
                                    <tr 
                                        key={idx} 
                                        className={`transition-colors ${
                                            isCurrentTier 
                                                ? 'bg-motorx-red/10 font-bold text-motorx-red border-l-4 border-l-motorx-red' 
                                                : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    >
                                        <td className="py-2.5 px-6">
                                            {tier.label}
                                            {isCurrentTier && (
                                                <span className="ml-2 text-[9px] bg-motorx-red text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-black">
                                                    Current Bid Tier
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-6 text-right font-black">
                                            ${tier.fee}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
