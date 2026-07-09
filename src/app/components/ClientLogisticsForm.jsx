import React, { useState, useEffect } from 'react';
import { Package, FileText, Save, AlertCircle } from 'lucide-react';
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

    // If vehicle status is actively in transit or processed by MotorX (e.g. loaded, delivered, in_transit, booked), it should be locked.
    // 'pending_dispatch' means the client has submitted it, but they can still edit it before MotorX actually processes it.
    const isLocked = vehicle.current_status && !['purchased', 'pending', 'pending_dispatch', 'assignment_pending'].includes(vehicle.current_status.toLowerCase());

    const [loading, setLoading] = useState(false);

    const initialTerminal = terminals.find(t => String(t.id) === String(vehicle.terminal_id));
    const [selectedHub, setSelectedHub] = useState(
        initialTerminal ? (initialTerminal.location || initialTerminal.name.split(' ')[0]) : ""
    );

    // Form State
    const [formData, setFormData] = useState({
        destination_id: vehicle.destination_id || "",
        terminal_id: vehicle.terminal_id || "",
        title_service_id: titleSvc ? (titleSvc.service_id || titleSvc.id) : "",
        dismantling_service_id: dismSvc ? (dismSvc.service_id || dismSvc.id) : "",
        setAsDefaultTerminal: false,
    });

    const uniqueHubs = Array.from(new Set(terminals.map(t => t.location || t.name.split(' ')[0]))).sort();
    const filteredTerminals = selectedHub ? terminals.filter(t => (t.location === selectedHub || t.name.startsWith(selectedHub))) : [];

    // Ensure state syncs if terminals load after mount or vehicle updates
    useEffect(() => {
        if (vehicle.terminal_id && !selectedHub && terminals.length > 0) {
            const term = terminals.find(t => String(t.id) === String(vehicle.terminal_id));
            if (term) {
                setSelectedHub(term.location || term.name.split(' ')[0]);
                setFormData(prev => ({ ...prev, terminal_id: vehicle.terminal_id }));
            }
        }
    }, [vehicle.terminal_id, terminals, selectedHub]);

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
            // Calculate prices to pass to the API for invoice_line_items
            const dispatchPrice = Number(tariffs.find(tr => 
                String(tr.origin_ref_id) === String(vehicle.location_id) && 
                (tr.destination_ref_id?.toString().toUpperCase() === selectedHub.toUpperCase() || tr.destination_name === selectedHub)
            )?.price_l1 || 0);

            const titlePrice = Number(titleOptions.find(o => String(o.service_id) === String(formData.title_service_id))?.price_l1 || 0);

            const payload = {
                ...formData,
                dispatch_price: dispatchPrice || undefined,
                title_price: titlePrice || undefined
            };

            const res = await fetch(`/api/client/vehicles/${vehicle.vin}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
                    <h3 className="font-bold text-slate-900 text-base uppercase">SERVICES CONFIGURATION</h3>
                    <p className="text-[11px] text-slate-500">Provide instructions for shipping and handling.</p>
                </div>
                {isLocked && (
                    <div className="bg-amber-50 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-amber-200">
                        Configuration is locked as logistics are already in progress.
                    </div>
                )}
            </div>

            <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Side: Dispatch Terminal */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Package size={16} className="text-blue-500" /> Dispatch Terminal
                            </label>
                            {selectedHub && (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 animate-in fade-in zoom-in duration-200">
                                    + ${Number(tariffs.find(tr => 
                                        String(tr.origin_ref_id) === String(vehicle.location_id) && 
                                        (tr.destination_ref_id?.toString().toUpperCase() === selectedHub.toUpperCase() || tr.destination_name === selectedHub)
                                    )?.price_l1 || 0).toFixed(2)}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Hub</label>
                                <select
                                    value={selectedHub}
                                    onChange={(e) => {
                                        setSelectedHub(e.target.value);
                                        handleChange('terminal_id', '');
                                    }}
                                    disabled={isLocked}
                                    className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-colors ${isLocked ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white'}`}
                                >
                                    <option value="">Select Hub...</option>
                                    {uniqueHubs.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Terminal</label>
                                <select
                                    value={formData.terminal_id}
                                    onChange={(e) => handleChange('terminal_id', e.target.value)}
                                    disabled={isLocked || !selectedHub}
                                    className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-colors ${isLocked || !selectedHub ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white'}`}
                                >
                                    <option value="">Select Terminal...</option>
                                    {filteredTerminals.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                    </div>

                    {/* Right Side: Title Handling */}
                    <div className="space-y-4 md:border-l md:border-slate-100 md:pl-8">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText size={16} className="text-orange-500" /> Title Services
                            </label>
                            {formData.title_service_id && (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    + ${Number(titleOptions.find(o => String(o.service_id) === String(formData.title_service_id))?.price_l1 || 0).toFixed(2)}
                                </span>
                            )}
                        </div>
                        <div className="space-y-2">
                            <select
                                value={formData.title_service_id}
                                onChange={(e) => handleChange('title_service_id', e.target.value)}
                                disabled={isLocked}
                                className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-colors ${isLocked ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-70' : 'bg-white'}`}
                            >
                                <option value="">Standard Title Handling</option>
                                {titleOptions.map(t => (
                                    <option key={t.service_id} value={t.service_id}>{t.service_name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-400 italic">Select if you need special title services like Lien Release or Duplicates.</p>
                        </div>
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
