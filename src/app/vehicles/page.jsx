"use client";
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import useUser from "@/utils/useUser";
import ClientVehiclesTable from "../components/ClientVehiclesTable";

export default function ClientVehiclesPage() {
    const { t } = useTranslation();
    const { data: user, loading: userLoading } = useUser();
    const [vehicles, setVehicles] = useState([]);
    const [clientStatus, setClientStatus] = useState('active');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Purchases');

    useEffect(() => {
        if (!user) return;

        fetch("/api/client/vehicles", { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { vehicles: [] })
            .then(d => {
                setVehicles(d.vehicles || []);
                if (d.clientStatus) setClientStatus(d.clientStatus);
            })
            .catch(err => {
                console.error("Failed to load vehicles", err);
                setVehicles([]);
            })
            .finally(() => setLoading(false));
    }, [user]);


    if (userLoading || (loading && vehicles.length === 0)) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    const filteredVehicles = vehicles.filter(v => {
        if (activeTab === 'Dispatch') {
            return v.dispatch_display_status && v.dispatch_display_status !== 'Completed';
        }
        if (activeTab === 'Title SVC') {
            return v.title_service_status && v.title_service_status !== 'Completed' && v.title_service_status !== 'Canceled';
        }
        return true; // Purchases and Reports show all base data
    });

    const tabs = ['Purchases', 'Dispatch', 'Title SVC'];

    return (
        <div className="space-y-6">
            {(user?.status === 'suspended' || clientStatus === 'suspended') && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-3">
                    <span className="text-2xl">🟡</span>
                    <div>
                        <h3 className="font-bold text-amber-900">{t('vehicles.account_suspended')}</h3>
                        <p className="text-sm">{t('vehicles.account_suspended_desc')}</p>
                    </div>
                </div>
            )}
            
            <div>
                <h1 className="text-2xl font-bold text-slate-900">{t('vehicles.my_vehicles')}</h1>
                <p className="text-slate-500 mt-1">{t('vehicles.track_purchases')}</p>
            </div>



            {/* Tabs */}
            <div className="flex space-x-1 border-b border-slate-200">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 ${
                            activeTab === tab
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}
                    >
                        {tab === 'Purchases' ? t('vehicles.tab_purchases') : tab === 'Dispatch' ? t('vehicles.tab_dispatch') : t('vehicles.tab_title_svc')}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <ClientVehiclesTable vehicles={filteredVehicles} activeTab={activeTab} />
            </div>
        </div>
    );
}
