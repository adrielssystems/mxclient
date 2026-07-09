"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import useUser from "@/utils/useUser";

import ClientVehicleReadOnlyInfo from "../../../components/ClientVehicleReadOnlyInfo";
import ClientVehicleReadOnlyFinancials from "../../../components/ClientVehicleReadOnlyFinancials";
import ClientVehicleReadOnlyLogistics from "../../../components/ClientVehicleReadOnlyLogistics";

export default function ClientVehicleDetailsPage() {
    const params = useParams();
    const navigate = useNavigate();
    const { data: user, loading: userLoading } = useUser();
    const vin = params?.vin;

    const [loading, setLoading] = useState(true);
    const [vehicle, setVehicle] = useState(null);
    const [services, setServices] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [dispatchData, setDispatchData] = useState(null);
    const [titleData, setTitleData] = useState(null);
    const [invoiceLineItems, setInvoiceLineItems] = useState([]);

    const fetchVehicleDetails = useCallback(async () => {
        if (!vin) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/client/vehicles/${vin}/details`);
            if (res.ok) {
                const data = await res.json();
                setVehicle(data.vehicle);
                setServices(data.services || []);
                setInvoices(data.invoices || []);
                setDispatchData(data.dispatchData);
                setTitleData(data.titleData);
                setInvoiceLineItems(data.invoiceLineItems || []);
            } else {
                toast.error("Vehicle not found or unauthorized.");
                navigate('/vehicles');
            }
        } catch (error) {
            console.error(error);
            toast.error("Error loading vehicle details");
        } finally {
            setLoading(false);
        }
    }, [vin, navigate]);

    useEffect(() => {
        if (!userLoading && user) {
            fetchVehicleDetails();
        }
    }, [user, userLoading, fetchVehicleDetails]);

    if (loading || !vehicle) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/vehicles')}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-3">
                            {vehicle.vin}
                        </h1>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate(`/vehicles/${vin}`)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors"
                    >
                        Configure Services
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-12 gap-4 xl:gap-6 items-start w-full">
                {/* Left Column: Info */}
                <div className="col-span-3">
                    <ClientVehicleReadOnlyInfo vehicle={vehicle} />
                </div>

                {/* Center Column: Logistics */}
                <div className="col-span-5">
                    <ClientVehicleReadOnlyLogistics 
                        vehicle={vehicle} 
                        services={services}
                        dispatchData={dispatchData}
                        titleData={titleData}
                        invoiceLineItems={invoiceLineItems}
                        invoices={invoices}
                    />
                </div>

                {/* Right Column: Financials */}
                <div className="col-span-4">
                    <ClientVehicleReadOnlyFinancials vehicle={vehicle} invoices={invoices} />
                </div>
            </div>
        </div>
    );
}
