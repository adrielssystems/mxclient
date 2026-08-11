import React from 'react';
import { ArrowLeft, Car } from 'lucide-react';
import { useTranslation } from "react-i18next";

export default function ClientVehicleHeader({ vehicle }) {
    const { t } = useTranslation();
    if (!vehicle) return null;

    const formatStatus = (s) => (s || "").split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    const getStatusColor = (s) => {
        if (!s) return 'bg-slate-100 text-slate-700 border-slate-200';
        if (['delivered', 'arrived'].includes(s)) return 'bg-green-100 text-green-800 border-green-200';
        if (['in_transit', 'loaded', 'booked'].includes(s)) return 'bg-blue-100 text-blue-800 border-blue-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
            <div className="flex items-center gap-4">
                <a
                    href="/vehicles"
                    className="p-2 -ml-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title={t('vehicle_details.back_to_vehicles')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </a>

                <div>
                    <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                            <Car size={14} className="text-blue-600" />
                        </div>
                        <h1 className="text-lg font-black text-slate-900 font-mono tracking-tight leading-none">
                            {vehicle.vin}
                        </h1>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(vehicle.current_status)}`}>
                            {t(`status.${(vehicle.current_status || '').toLowerCase().replace(/ /g, '_')}`, { defaultValue: formatStatus(vehicle.current_status) })}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-1 pl-9">
                        <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
                        <span className="text-slate-300">•</span>
                        <span>{t('vehicle_details.lot')}: <span className="text-slate-800 font-mono">{vehicle.lot_number || t('vehicle_details.n_a')}</span></span>
                    </div>
                </div>
            </div>

            {/* Payment Status Pill */}
            <div className="flex items-center gap-3 pl-9 sm:pl-0">
                <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-2">
                    {t('vehicle_details.payment_label')}:
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                        vehicle.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                        {t(`status.${(vehicle.payment_status || '').toLowerCase().replace(/ /g, '_')}`, { defaultValue: formatStatus(vehicle.payment_status) })}
                    </span>
                </div>
            </div>
        </div>
    );
}
