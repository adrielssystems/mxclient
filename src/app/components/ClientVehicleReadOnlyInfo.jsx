"use client";
import React, { useState } from 'react';
import { Calendar, MapPin, Hash, FileText, User, Copy, Check, Download, Eye } from 'lucide-react';
import { formatToMDY } from "@/utils/dateUtils";

// A read-only component for vehicle ownership documents
function ClientReadOnlyOwnershipDocuments({ vehicle }) {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        if (vehicle?.id) {
            fetch(`/api/client/vehicles/${vehicle.vin}/documents`)
                .then(res => res.json())
                .then(data => {
                    setDocs(data.documents || []);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [vehicle]);

    if (loading) {
        return <div className="text-xs text-slate-400 p-4 text-center">Loading documents...</div>;
    }

    if (docs.length === 0) {
        return (
            <div className="border border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-slate-50">
                <FileText className="h-6 w-6 text-slate-300 mb-2" />
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No Documents Yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Ownership Documents</label>
            </div>
            {docs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-colors group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{doc.doc_type || 'Document'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{doc.file_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <a 
                            href={doc.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Document"
                        >
                            <Eye size={14} />
                        </a>
                        <a 
                            href={doc.download_url || doc.file_url} 
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Download Document"
                        >
                            <Download size={14} />
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function ClientVehicleReadOnlyInfo({ vehicle }) {
    if (!vehicle) return null;

    const [copiedField, setCopiedField] = useState(null);

    const handleCopy = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
            {/* Card Header */}
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Vehicle Information
                </h3>
            </div>

            <div className="p-4 space-y-4">
                {/* Description */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Description</label>
                    <div className="text-sm font-black text-slate-900 break-words leading-snug">
                        {vehicle.description ? vehicle.description.replace(/\s*\([^)]*\)\s*/g, '').trim() : 'No description'}
                    </div>
                </div>

                {/* Purchase Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Purchase Date</label>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatToMDY(vehicle.purchase_date)}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Lot Number</label>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 font-mono">
                            <Hash className="h-3.5 w-3.5 text-slate-400" />
                            {vehicle.lot_number || '-'}
                        </div>
                    </div>
                </div>

                <hr className="border-slate-100" />

                {/* Origin & Location */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Origin & Location</label>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-3 text-xs">
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px]">Auction</span>
                            <span className="font-bold text-slate-800">{vehicle.auction_name || '-'}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-500 uppercase tracking-widest text-[9px]">Location</span>
                            <span className="font-bold text-slate-800 flex items-start gap-1">
                                <MapPin className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                                <span>{vehicle.auction_location || '-'}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Owner / Client */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Owner / Client</label>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-blue-50/50 px-3 py-2.5 rounded-lg border border-blue-100/50">
                        <User className="h-4 w-4 text-blue-500" />
                        {vehicle.buyer_name || '-'}
                    </div>
                </div>

                {/* Buyer & PIN */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">PIN #</label>
                        <div className="flex items-start justify-between text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 font-mono break-all">
                            <span>{vehicle.pin_number || '-'}</span>
                            {vehicle.pin_number && (
                                <button onClick={() => handleCopy(vehicle.pin_number, 'pin')} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2">
                                    {copiedField === 'pin' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Buyer #</label>
                        <div className="flex items-start justify-between text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 font-mono break-words">
                            <span>{vehicle.buyer_number || '-'}</span>
                            {vehicle.buyer_number && (
                                <button onClick={() => handleCopy(vehicle.buyer_number, 'buyer')} className="text-slate-400 hover:text-slate-600 shrink-0 ml-2">
                                    {copiedField === 'buyer' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dealer */}
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Dealer (Source)</label>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                        {vehicle.dl_number || '-'}
                    </div>
                </div>

                <hr className="border-slate-100" />

                {/* Documents */}
                <ClientReadOnlyOwnershipDocuments vehicle={vehicle} />

            </div>
        </div>
    );
}
