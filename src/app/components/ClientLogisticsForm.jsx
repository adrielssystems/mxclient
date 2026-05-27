import React, { useState } from 'react';
import { Package, FileText, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientLogisticsForm({
    vehicle,
    services,
    terminals,
    destinations,
    titleOptions,
    dismantlingOptions,
    tariffs = [],
    onDraftChange,
    onUpdate
}) {
    if (!vehicle) return null;

    // Find current active Terminal/Title/Dismantling
    const titleSvc = services.find(s => s.service_category === 'TITLE');
    const dismSvc = services.find(s => s.service_category === 'DISMANTLING');

    // If vehicle status is anything but purchased/pending (e.g. pending_dispatch, loaded, delivered), it should be locked.
    const isLocked = vehicle.current_status && !['purchased', 'pending'].includes(vehicle.current_status.toLowerCase());

    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        destination_id: vehicle.destination_id || "",
        terminal_id: vehicle.terminal_id || "",
        title_service_id: titleSvc ? (titleSvc.service_id || titleSvc.id) : "",
        dismantling_service_id: dismSvc ? (dismSvc.service_id || dismSvc.id) : "",
    });

    const handleChange = (field, value) => {
        const newData = { ...formData, [field]: value };
        setFormData(newData);
        if (onDraftChange) {
            onDraftChange({
                terminal_id: newData.terminal_id,
                title_service_id: newData.title_service_id
            });
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/client/vehicles/${vehicle.vin}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success("Delivery configuration saved!");
                if (onUpdate) onUpdate();
            } else {
                toast.error("Failed to save configuration.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error saving data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-900 text-base">Delivery Configuration</h3>
                    <p className="text-[11px] text-slate-500">Provide instructions for shipping and handling.</p>
                </div>
                {isLocked && (
                    <div className="bg-amber-50 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-amber-200">
                        Configuration is locked as logistics are already in progress.
                    </div>
                )}
            </div>

            <div className="p-4 space-y-5">
                {/* 1. Terminal Assignment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Package size={14} className="text-blue-500" /> Dispatch Terminal
                            </label>
                            {formData.terminal_id && String(formData.terminal_id) !== String(vehicle.terminal_id) && (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 animate-in fade-in zoom-in duration-200">
                                    + ${Number(tariffs.find(tr => 
                                        String(tr.origin_ref_id) === String(vehicle.location_id) && 
                                        (tr.destination_name === terminals.find(t => String(t.id) === String(formData.terminal_id))?.location)
                                    )?.price_l1 || 0).toFixed(2)}
                                </span>
                            )}
                        </div>
                        <select
                            value={formData.terminal_id}
                            onChange={(e) => handleChange('terminal_id', e.target.value)}
                            disabled={isLocked}
                            className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-colors ${isLocked ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white'}`}
                        >
                            <option value="">Select Terminal...</option>
                            {terminals.map(t => (
                                <option key={t.id} value={t.id}>{t.name} {t.location ? `(${t.location})` : ''}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 italic">Where should the vehicle be delivered locally?</p>
                    </div>

                    {/* Shipping Destination Hidden for V2 */}
                    <div className="hidden">
                        {/* Hidden Shipping Destination */}
                    </div>
                </div>

                <div className="border-t border-slate-100 my-6"></div>

                {/* 3. Title & Optional Services */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={14} className="text-orange-500" /> Title Handling
                            </label>
                            {formData.title_service_id && String(formData.title_service_id) !== (titleSvc ? String(titleSvc.service_id || titleSvc.id) : "") && (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 animate-in fade-in zoom-in duration-200">
                                    + ${Number(titleOptions.find(o => String(o.service_id) === String(formData.title_service_id))?.price_l1 || 0).toFixed(2)}
                                </span>
                            )}
                        </div>
                        <select
                            value={formData.title_service_id}
                            onChange={(e) => handleChange('title_service_id', e.target.value)}
                            disabled={isLocked}
                            className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-colors ${isLocked ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white'}`}
                        >
                            <option value="">Standard Title Handling</option>
                            {titleOptions.map(t => (
                                <option key={t.service_id} value={t.service_id}>{t.service_name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 italic">Select if you need special title services like Lien Release or Duplicates.</p>
                    </div>

                    {/* Dismantling Hidden for V2 */}
                    <div className="hidden">
                    </div>
                </div>

            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={loading || isLocked}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={14} />}
                    Save Configuration
                </button>
            </div>
        </div>
    );
}
