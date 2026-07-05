"use client";
import React, { useState, useEffect, useMemo } from "react";
import useUser from "@/utils/useUser";
import { DollarSign, FileText, Truck, CheckCircle2, Car } from 'lucide-react';
import ClientVehiclesTable from "../components/ClientVehiclesTable";

import ClientReportsDashboard from "../components/ClientReportsDashboard";

export default function ClientVehiclesPage() {
    const { data: user, loading: userLoading } = useUser();
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Purchases');

    useEffect(() => {
        if (!user) return;

        fetch("/api/client/vehicles", { cache: 'no-store' })
            .then(r => r.ok ? r.json() : { vehicles: [] })
            .then(d => setVehicles(d.vehicles || []))
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

    // Calculate Metrics
    const metrics = useMemo(() => {
        let notPaid = 0;
        let titlesReceived = 0;
        let activeDispatch = 0;
        let activeTitleServices = 0;

        vehicles.forEach(v => {
            const purchaseStatus = (v.purchase_status || '').toLowerCase();
            if (['new', 'pending', 'late', 'payment_pending'].includes(purchaseStatus)) {
                notPaid++;
            }
            
            if (v.title_service_status === 'Received') {
                titlesReceived++;
            }
            
            if (v.title_service_status && v.title_service_status !== 'Completed' && v.title_service_status !== 'Canceled') {
                activeTitleServices++;
            }

            if (v.dispatch_display_status && ['New', 'In Transit', 'Today', 'Late', 'Pending'].includes(v.dispatch_display_status)) {
                activeDispatch++;
            }
        });

        return {
            totalPurchases: vehicles.length,
            notPaid,
            titlesReceived,
            activeDispatch,
            activeTitleServices
        };
    }, [vehicles]);

    const tabs = ['Purchases', 'Dispatch', 'Title SVC', 'Reports'];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">My Vehicles</h1>
                <p className="text-slate-500 mt-1">Track the transport and payment status of your purchases.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Car className="h-4 w-4" /></div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Purchases</h4>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{metrics.totalPurchases}</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><DollarSign className="h-4 w-4" /></div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Not Paid</h4>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{metrics.notPaid}</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="h-4 w-4" /></div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Titles Received</h4>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{metrics.titlesReceived}</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-sky-50 text-sky-600 rounded-lg"><Truck className="h-4 w-4" /></div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Active Dispatch</h4>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{metrics.activeDispatch}</div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><FileText className="h-4 w-4" /></div>
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Title SVC (Active)</h4>
                    </div>
                    <div className="text-2xl font-black text-slate-900">{metrics.activeTitleServices}</div>
                </div>
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
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'Reports' ? (
                <ClientReportsDashboard vehicles={vehicles} />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <ClientVehiclesTable vehicles={filteredVehicles} />
                </div>
            )}
        </div>
    );
}
