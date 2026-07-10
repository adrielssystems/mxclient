import React, { useState, useEffect } from 'react';
import { FileText, Save, AlertTriangle, Upload, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function VehicleTitleTab({ vehicle, onUpdate, isClient = false, isLocked = false }) {
    const [titleTracking, setTitleTracking] = useState({
        mailing_location: "",
        has_lien: false,
        client_notes: "",
        title_number: "",
        tracking_number: "",
        employee_notes: "",
        manual_status: "",
        computed_status: "Not Received",
        date_received: null,
        date_mailed: null,
        title_file_url: null
    });
    const [trackingLoading, setTrackingLoading] = useState(true);
    const [savingTracking, setSavingTracking] = useState(false);
    const [terminals, setTerminals] = useState([]);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [initiallyConfigured, setInitiallyConfigured] = useState(false);

    useEffect(() => {
        fetchTitleTracking();
        fetchTerminals();
    }, [vehicle.vin]);

    const fetchTerminals = async () => {
        try {
            const res = await fetch('/api/admin/terminals');
            if (res.ok) {
                const data = await res.json();
                setTerminals(data.terminals || data.data || []);
            }
        } catch (e) { console.error("Terminals fetch failed"); }
    };

    const fetchTitleTracking = async () => {
        try {
            const res = await fetch(`/api/vehicles/${vehicle.vin}/title-tracking`);
            if (res.ok) {
                const json = await res.json();
                if (json.data) {
                    setTitleTracking(json.data);
                    if (json.data.mailing_location) {
                        setInitiallyConfigured(true);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch title tracking", error);
        } finally {
            setTrackingLoading(false);
        }
    };

    const handleSaveTitleTracking = async () => {
        // Fix #2: Validate Client Notes min 6 chars when Mailing Location = "Others"
        if (titleTracking.mailing_location === 'Others') {
            if (!titleTracking.client_notes || titleTracking.client_notes.trim().length < 6) {
                toast.error("Client Notes required (min. 6 characters) when 'Others' is selected as Mailing Location.");
                return;
            }
        }

        setSavingTracking(true);
        try {
            const res = await fetch(`/api/vehicles/${vehicle.vin}/title-tracking`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(titleTracking)
            });
            if (res.ok) {
                const json = await res.json();
                setTitleTracking(json.data);
                toast.success("Title tracking updated");
                if (onUpdate) onUpdate();
            } else {
                toast.error("Failed to update tracking");
            }
        } catch (error) {
            toast.error("Error saving tracking");
        } finally {
            setSavingTracking(false);
        }
    };

    const handleTitleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingPdf(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result;
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        base64,
                        vin: vehicle.vin,
                        documentType: 'TITLE'
                    })
                });

                if (res.ok) {
                    // Sync with Ownership Documents List
                    await fetch(`/api/vehicles/${vehicle.vin}/ownership-documents`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            base64,
                            tag: 'Title (Front+Back)'
                        })
                    });
                    
                    toast.success("Title PDF uploaded & Email Sent");
                    if (onUpdate) onUpdate();
                    fetchTitleTracking();
                } else {
                    toast.error("Upload failed");
                }
                setUploadingPdf(false);
            };
        } catch (err) {
            toast.error("Upload error");
            setUploadingPdf(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Derived flags
    const isMissingMailingInfo = titleTracking.date_received && !titleTracking.mailing_location;

    // Fix #3: FILE required — Title# exists but no file uploaded
    const isFileMissing = !isClient && titleTracking.title_number && !titleTracking.title_file_url;

    // Status badge colors (covers all 8 possible statuses incl. manual)
    const statusStyle = {
        'Received':   'bg-green-100 text-green-800',
        'Sent':       'bg-slate-700 text-white',
        'Missing':    'bg-purple-100 text-purple-700',
        'Lost':       'bg-red-100 text-red-700',
        'Pending':    'bg-orange-100 text-orange-700',
        'Driver':     'bg-slate-900 text-white',
        'Mailing In': 'bg-blue-100 text-blue-700',
    };
    const currentStatusStyle = statusStyle[titleTracking.computed_status] || 'bg-slate-200 text-slate-800';

    const isClientLocked = isClient && initiallyConfigured;
    const finalIsLocked = isLocked || isClientLocked;

    return (
        <div className="space-y-6 p-1">

            {/* ── TITLE TRACKING MODULE ── */}
            <div className={`p-5 rounded-xl border shadow-sm ${isMissingMailingInfo ? 'border-red-400 bg-red-50/10' : 'border-blue-200 bg-blue-50/30'}`}>
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <h3 className="text-lg font-black text-blue-900 flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        Master Title Tracking
                    </h3>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* ENTER banner — missing mailing location */}
                        {isMissingMailingInfo && (
                            <div className="bg-red-600 text-yellow-300 font-black px-4 py-1.5 rounded uppercase flex items-center gap-2 animate-pulse shadow-md border-2 border-red-700 text-xs">
                                <AlertTriangle size={14} /> ENTER MAILING LOCATION
                            </div>
                        )}
                        {/* FILE missing warning */}
                        {isFileMissing && (
                            <div className="bg-amber-500 text-white font-black px-3 py-1.5 rounded uppercase flex items-center gap-1.5 text-[10px] shadow-sm border border-amber-600">
                                <Upload size={12} /> TITLE PDF REQUIRED
                            </div>
                        )}
                        {/* Status badge */}
                        <span className={`px-3 py-1 rounded-full font-bold text-xs ${currentStatusStyle}`}>
                            {titleTracking.computed_status}
                        </span>
                        {/* Save */}
                        {!(isClient && initiallyConfigured) && (
                            <button
                                onClick={handleSaveTitleTracking}
                                disabled={savingTracking || finalIsLocked}
                                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Save size={14} /> {savingTracking ? 'Saving...' : 'Save'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* ── CLIENT / GENERAL FIELDS ── */}
                    <div className="space-y-4 bg-white p-4 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-400 uppercase border-b pb-2">Client Details</h4>

                        {/* Mailing Location */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 mb-1 block">Mailing Location *</label>
                            <select
                                id="title-mailing-location"
                                name="mailing_location"
                                value={titleTracking.mailing_location}
                                onChange={e => setTitleTracking({...titleTracking, mailing_location: e.target.value})}
                                disabled={finalIsLocked}
                                className={`w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 ${isMissingMailingInfo ? 'border-red-500 bg-red-50' : 'border-slate-300'} ${finalIsLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed opacity-80' : ''}`}
                            >
                                <option value="">Select Destination...</option>
                                {terminals.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                                <option value="Others">Others (Specify in notes)</option>
                            </select>
                        </div>

                        {/* Lien */}
                        {isClient ? (
                            titleTracking.has_lien && (
                                <div className="mt-4 bg-purple-50 border border-purple-200 p-3 rounded-lg flex items-center gap-2 shadow-sm">
                                    <AlertTriangle size={16} className="text-purple-600 flex-shrink-0" />
                                    <span className="text-xs font-black text-purple-800 uppercase tracking-widest">
                                        ⚠️ THIS TITLE HAS A LIEN
                                    </span>
                                </div>
                            )
                        ) : (
                            <div className="flex items-center gap-2 mt-4">
                                <input
                                    id="title-has-lien"
                                    name="has_lien"
                                    type="checkbox"
                                    checked={titleTracking.has_lien}
                                    onChange={e => setTitleTracking({...titleTracking, has_lien: e.target.checked})}
                                    disabled={finalIsLocked}
                                    className={`h-4 w-4 text-blue-600 rounded border-gray-300 ${finalIsLocked ? 'cursor-not-allowed opacity-70' : ''}`}
                                />
                                <label className="text-sm font-bold text-slate-700">Vehicle has a Lien</label>
                                {titleTracking.has_lien && (
                                    <span className="ml-auto text-[10px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded uppercase border border-purple-200">
                                        This title has a Lien
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Client Notes */}
                        <div>
                            <label className="text-xs font-bold text-slate-700 mb-1 block">
                                Client Notes{' '}
                                {titleTracking.mailing_location === 'Others' && (
                                    <span className="text-red-500">* (Required — min. 6 chars)</span>
                                )}
                            </label>
                            <textarea
                                id="title-client-notes-tracking"
                                name="client_notes"
                                value={titleTracking.client_notes || ""}
                                onChange={e => setTitleTracking({...titleTracking, client_notes: e.target.value})}
                                disabled={finalIsLocked}
                                rows={3}
                                className={`w-full p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 ${
                                    titleTracking.mailing_location === 'Others' &&
                                    (!titleTracking.client_notes || titleTracking.client_notes.trim().length < 6)
                                        ? 'border-red-400 bg-red-50/30'
                                        : 'border-slate-300'
                                } ${finalIsLocked ? 'bg-slate-50 text-slate-500 cursor-not-allowed opacity-80' : ''}`}
                                placeholder={
                                    titleTracking.mailing_location === 'Others'
                                        ? "Please provide full mailing address..."
                                        : "Any special title instructions..."
                                }
                            />
                            {/* Inline char counter when Others + short */}
                            {titleTracking.mailing_location === 'Others' &&
                                titleTracking.client_notes &&
                                titleTracking.client_notes.trim().length < 6 && (
                                <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                                    <AlertTriangle size={10} /> Minimum 6 characters required
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ── ADMIN FIELDS (Hidden from Client) ── */}
                    {!isClient && (
                        <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h4 className="text-xs font-bold text-slate-500 uppercase">Internal Tracking (Motor X)</h4>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Title # */}
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-1 block">Title #</label>
                                    <input
                                        id="title-number-tracking"
                                        name="title_number"
                                        type="text"
                                        value={titleTracking.title_number || ""}
                                        onChange={e => setTitleTracking({...titleTracking, title_number: e.target.value})}
                                        className="w-full p-2 text-sm border border-slate-300 rounded font-mono"
                                        placeholder="T-123456"
                                    />
                                </div>

                                {/* Tracking # */}
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-1 block">Tracking # (Outbound)</label>
                                    <input
                                        id="title-outbound-tracking"
                                        name="tracking_number"
                                        type="text"
                                        value={titleTracking.tracking_number || ""}
                                        onChange={e => setTitleTracking({...titleTracking, tracking_number: e.target.value})}
                                        className="w-full p-2 text-sm border border-slate-300 rounded font-mono"
                                        placeholder="1Z9999..."
                                    />
                                </div>

                                {/* Fix #4: Date Received + Date Mailed — visible to employees */}
                                <div className={`col-span-2 grid grid-cols-2 gap-3 rounded-lg p-3 ${titleTracking.date_received ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-100 border border-slate-200'}`}>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Calendar size={9} /> Date Received
                                        </span>
                                        <span className={`text-[11px] font-black ${titleTracking.date_received ? 'text-emerald-700' : 'text-slate-400 italic'}`}>
                                            {titleTracking.date_received ? formatDate(titleTracking.date_received) : 'Auto-set on Title # entry'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            <Clock size={9} /> Date Mailed
                                        </span>
                                        <span className={`text-[11px] font-black ${titleTracking.date_mailed ? 'text-blue-700' : 'text-slate-400 italic'}`}>
                                            {titleTracking.date_mailed ? formatDate(titleTracking.date_mailed) : 'Auto-set on Tracking # entry'}
                                        </span>
                                    </div>
                                </div>

                                {/* Manual Status */}
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-700 mb-1 block">Manual Status Override</label>
                                    <select
                                        id="title-manual-status-override"
                                        name="manual_status"
                                        value={titleTracking.manual_status || ""}
                                        onChange={e => setTitleTracking({...titleTracking, manual_status: e.target.value})}
                                        className="w-full p-2 text-sm border border-slate-300 rounded"
                                    >
                                        <option value="">-- No Override (Auto) --</option>
                                        <option value="Missing">Missing</option>
                                        <option value="Lost">Lost</option>
                                        <option value="Driver">Driver</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Mailing In">Mailing In</option>
                                    </select>
                                    <p className="text-[9px] text-slate-400 italic mt-1">
                                        ⚠️ Auto status (Received / Sent) always overrides this selection.
                                    </p>
                                </div>

                                {/* Employee Notes */}
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-700 mb-1 block">Employee Notes</label>
                                    <textarea
                                        id="title-employee-notes-tracking"
                                        name="employee_notes"
                                        value={titleTracking.employee_notes || ""}
                                        onChange={e => setTitleTracking({...titleTracking, employee_notes: e.target.value})}
                                        rows={2}
                                        className="w-full p-2 text-sm border border-slate-300 rounded"
                                        placeholder="Internal operational notes..."
                                    />
                                </div>

                                {/* FILE Upload */}
                                <div className="col-span-2 pt-2 space-y-2">
                                    {isFileMissing && (
                                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                                            <Upload size={12} className="text-amber-600 flex-shrink-0" />
                                            <span className="text-[10px] font-black text-amber-700 uppercase">
                                                Title PDF is required when Title # is entered
                                            </span>
                                        </div>
                                    )}
                                    <label className="relative flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white border-2 border-dashed border-slate-300 cursor-pointer rounded-lg hover:bg-slate-50 transition-colors">
                                        <Upload size={16} className="text-blue-500" />
                                        {uploadingPdf
                                            ? 'Uploading & Notifying...'
                                            : titleTracking.title_number
                                                ? 'Upload Title PDF (Sends Email)'
                                                : 'Upload PDF (Requires Title #)'}
                                        <input
                                            id="title-file-upload"
                                            name="title_file"
                                            type="file"
                                            className="hidden"
                                            accept="application/pdf"
                                            onChange={handleTitleUpload}
                                            disabled={uploadingPdf || !titleTracking.title_number}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
