"use client";
import React, { useState } from 'react';
import { DollarSign, Truck, FileText, CheckCircle, Clock } from 'lucide-react';
import { formatToMDY } from "@/utils/dateUtils";
import { formatCurrency } from "@/utils/formatUtils";

export default function ClientVehicleReadOnlyLogistics({ vehicle, services, dispatchData, titleData, fees }) {
    const initialTab = vehicle?.purchase_source === 'MotorX' ? 'purchases' : 'dispatch';
    const [activeTab, setActiveTab] = useState(initialTab);

    // Filter services
    const dispatchSvc = services.find(s => s.service_category === 'DISPATCH');
    const titleSvc = services.find(s => s.service_category === 'TITLE');

    const renderPurchasesTab = () => {
        // Calculate totals
        const purchasePrice = parseFloat(vehicle?.client_base_price) || 0;
        let feesTotal = 0;
        fees.forEach(f => { feesTotal += parseFloat(f.amount) || 0; });
        const totalCost = purchasePrice + feesTotal;

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <DollarSign size={16} className="text-blue-500" /> Purchase Breakdown
                    </h3>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Invoice</p>
                        <p className="text-lg font-black text-slate-900">{formatCurrency(totalCost)}</p>
                        {vehicle?.payment_status && (
                            <span className={`inline-flex px-2 py-0.5 mt-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                                vehicle.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                                {vehicle.payment_status.replace('_', ' ')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Source Details */}
                    <div className="md:col-span-5 bg-slate-50 rounded-xl p-5 border border-slate-100 h-fit space-y-5">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auction Details (Source)</h4>
                        <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Winning Bid Amount</p>
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(purchasePrice)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold">Auction House</p>
                                <p className="text-sm font-bold text-slate-700">{vehicle?.auction_name || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold">Date</p>
                                <p className="text-sm font-bold text-slate-700">{formatToMDY(vehicle?.purchase_date) || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="md:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <span>Description</span>
                            <span>Amount</span>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-end gap-2 w-full">
                                <span className="text-sm font-bold text-slate-700 shrink-0">Purchase Price</span>
                                <div className="flex-1 border-b-2 border-dotted border-slate-200 mb-1.5 mx-1"></div>
                                <span className="text-sm font-black text-slate-900 whitespace-nowrap shrink-0">{formatCurrency(purchasePrice)}</span>
                            </div>
                            {fees.map((fee, idx) => (
                                <div key={idx} className="flex items-end gap-2 w-full group">
                                    <span className="text-sm font-bold text-slate-500 leading-snug shrink-0 group-hover:text-slate-700 transition-colors">{fee.description?.split(' for ')[0] || fee.description}</span>
                                    <div className="flex-1 border-b-2 border-dotted border-slate-200 mb-1.5 mx-1 group-hover:border-slate-300 transition-colors"></div>
                                    <span className="text-sm font-black text-slate-900 whitespace-nowrap shrink-0">{formatCurrency(fee.amount)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center rounded-b-xl">
                            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Total Purchase Cost</span>
                            <span className="text-lg font-black text-white">{formatCurrency(totalCost)}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderDispatchTab = () => {
        const isRequired = !!dispatchSvc;
        const price = dispatchSvc?.price || 0;

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Truck size={20} />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Dispatch Service Required?</h3>
                            <div className="mt-2 flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${!isRequired ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}>NO</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${isRequired ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'}`}>YES</span>
                            </div>
                        </div>
                    </div>
                    {isRequired && (
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pricing (Client Price)</p>
                            <p className="text-lg font-black text-slate-900">${parseFloat(price).toFixed(2)}</p>
                        </div>
                    )}
                </div>

                {isRequired && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Locations */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Hub</label>
                                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                        {vehicle?.terminal_name ? vehicle.terminal_name.split(' ')[0] : 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Terminal</label>
                                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 truncate">
                                        {vehicle?.terminal_name || 'N/A'}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Est. Pick Up</label>
                                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400" />
                                        {formatToMDY(dispatchData?.estimated_pickup_date) || '-'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Est. Delivery</label>
                                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400" />
                                        {formatToMDY(dispatchData?.estimated_delivery_date) || '-'}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Actual Delivery</label>
                                <div className="bg-slate-900 text-white px-4 py-2.5 rounded-lg font-bold text-sm shadow-inner flex justify-between items-center">
                                    <span>{formatToMDY(dispatchData?.actual_delivery_date) || 'Pending'}</span>
                                    {dispatchData?.actual_delivery_date && <CheckCircle size={16} className="text-emerald-400" />}
                                </div>
                            </div>
                        </div>

                        {/* Status & Notes */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pick-up Status</label>
                                <div className="flex items-center gap-2">
                                    <div className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest border ${
                                        dispatchData?.picked_up ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                        {dispatchData?.picked_up ? '✓ Carrier Has Vehicle' : 'Pending Pick-up'}
                                    </div>
                                    <div className={`px-4 py-1 rounded border text-[11px] font-black uppercase tracking-widest ${
                                        dispatchData?.picked_up ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200'
                                    }`}>
                                        Picked Up {dispatchData?.picked_up && '✓'}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-2">
                                    Client Notes (Portal)
                                </label>
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 min-h-[80px] text-sm text-slate-700">
                                    {dispatchData?.client_notes || <span className="text-slate-400 italic">No notes</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderTitleTab = () => {
        const isRequired = !!titleSvc;
        const price = titleSvc?.price || 0;

        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Title Services Required?</h3>
                            <div className="mt-2 flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${!isRequired ? 'bg-violet-500 text-white border-violet-600' : 'bg-white text-slate-400 border-slate-200'}`}>NO</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${isRequired ? 'bg-violet-500 text-white border-violet-600' : 'bg-white text-slate-400 border-slate-200'}`}>YES</span>
                            </div>
                        </div>
                    </div>
                    {isRequired && (
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pricing (Client Price)</p>
                            <p className="text-lg font-black text-slate-900">${parseFloat(price).toFixed(2)}</p>
                        </div>
                    )}
                </div>

                {isRequired && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Service Type</label>
                                <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    {titleSvc?.service_name || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Port / Country</label>
                                <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                                    {vehicle?.destination_port ? `${vehicle.destination_port}, ${vehicle.destination_country}` : 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="border border-green-200 rounded-xl p-4 bg-green-50/30">
                            <h4 className="text-[10px] font-black text-green-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Clock size={14} /> Operational Status
                            </h4>
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Requested</label>
                                    <div className="bg-white px-3 py-2 rounded border border-slate-200 text-xs font-bold text-slate-700">
                                        {formatToMDY(titleData?.date_requested) || '-'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Approved</label>
                                    <div className="bg-white px-3 py-2 rounded border border-slate-200 text-xs font-bold text-slate-700">
                                        {formatToMDY(titleData?.date_approved) || '-'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Received</label>
                                    <div className="bg-white px-3 py-2 rounded border border-slate-200 text-xs font-bold text-slate-700">
                                        {formatToMDY(titleData?.date_received) || '-'}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 rounded-lg p-3 text-white">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mailing IN (TRK)</label>
                                    <div className="font-bold text-sm truncate">{titleData?.mailing_in_tracking || '-'}</div>
                                </div>
                                <div className="bg-blue-600 rounded-lg p-3 text-white">
                                    <label className="text-[9px] font-black text-blue-200 uppercase tracking-widest block mb-1">Mailed OUT (TRK)</label>
                                    <div className="font-bold text-sm truncate">{titleData?.mailing_out_tracking || '-'}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1 flex items-center gap-2">
                                Client Notes
                            </label>
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 min-h-[80px] text-sm text-slate-700">
                                {titleData?.client_notes || <span className="text-slate-400 italic">No notes</span>}
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-4 items-center">
                <button
                    onClick={() => setActiveTab('purchases')}
                    className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors flex items-center gap-2 ${
                        activeTab === 'purchases' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                    <DollarSign size={14} /> Purchases
                </button>
                <button
                    onClick={() => setActiveTab('dispatch')}
                    className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors flex items-center gap-2 ${
                        activeTab === 'dispatch' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                    <Truck size={14} /> Dispatch
                </button>
                <button
                    onClick={() => setActiveTab('title')}
                    className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors flex items-center gap-2 ${
                        activeTab === 'title' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                    <FileText size={14} /> Title Services
                </button>
            </div>

            <div className="p-4 sm:p-6 flex-1">
                {activeTab === 'purchases' && renderPurchasesTab()}
                {activeTab === 'dispatch' && renderDispatchTab()}
                {activeTab === 'title' && renderTitleTab()}
            </div>
        </div>
    );
}
