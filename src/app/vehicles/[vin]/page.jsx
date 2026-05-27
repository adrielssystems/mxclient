"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import useUser from "@/utils/useUser";
import ClientVehicleHeader from "../../components/ClientVehicleHeader";
import ClientLogisticsForm from "../../components/ClientLogisticsForm";
import ClientFinancialCard from "../../components/ClientFinancialCard";
import VehicleTitleTab from "../../components/VehicleTitleTab";

export default function ClientVehiclePage() {
    const params = useParams();
    const navigate = useNavigate();
    const { data: user, loading: userLoading } = useUser();

    // Explicit unwrapping of the params is required in next 15+ but standard react is fine
    // Since this is Next.js app router we use params.vin
    const vin = params?.vin;

    const [loading, setLoading] = useState(true);
    const [vehicle, setVehicle] = useState(null);
    const [services, setServices] = useState([]);

    // Aux data
    const [terminals, setTerminals] = useState([]);
    const [destinations, setDestinations] = useState([]);
    const [titleOptions, setTitleOptions] = useState([]);
    const [dismantlingOptions, setDismantlingOptions] = useState([]);
    const [tariffs, setTariffs] = useState([]);

    // Draft State for real-time subtotal
    const [draftConfig, setDraftConfig] = useState({
        terminal_id: "",
        title_service_id: ""
    });

    const fetchVehicleData = useCallback(async () => {
        if (!vin) return;
        setLoading(true);
        try {
            const [vehRes, termRes, destRes, titleRes, dismRes, tariffRes] = await Promise.all([
                fetch(`/api/client/vehicles/${vin}`),
                fetch('/api/admin/terminals'),
                fetch('/api/admin/destinations'), // Destinations/Ports
                fetch('/api/admin/services/charges?category=TITLE'),
                fetch('/api/admin/services/charges?category=DISMANTLING'),
                fetch('/api/admin/tariffs?type=DISPATCH'),
            ]);

            if (vehRes.ok) {
                const data = await vehRes.json();
                setVehicle(data.vehicle);
                setServices(data.services || []);
                
                // Initialize draft from current vehicle data
                const titleSvc = (data.services || []).find(s => s.service_category === 'TITLE');
                setDraftConfig({
                    terminal_id: data.vehicle.terminal_id || "",
                    title_service_id: titleSvc ? (titleSvc.service_id || titleSvc.id) : ""
                });
            } else {
                toast.error("Vehicle not found or unauthorized.");
                navigate('/');
                return;
            }

            if (termRes.ok) {
                const termData = await termRes.json();
                setTerminals(termData.terminals || []);
            }

            if (tariffRes.ok) {
                const tData = await tariffRes.json();
                setTariffs(tData.tariffs || []);
            }

            if (destRes.ok) {
                const destData = await destRes.json();
                setDestinations(destData.destinations || []); 
            }

            if (titleRes.ok) {
                const tData = await titleRes.json();
                setTitleOptions(tData.charges || []);
            } else {
                // Mock fallback
                setTitleOptions([
                    { service_id: 1, service_name: 'Duplicate Title', price_l1: 50 },
                    { service_id: 2, service_name: 'Lien Release', price_l1: 35 },
                ]);
            }

            if (dismRes.ok) {
                const dData = await dismRes.json();
                setDismantlingOptions(dData.charges || []);
            } else {
                // Mock fallback
                setDismantlingOptions([
                    { service_id: 3, service_name: 'Front Cut', price_l1: 200 },
                    { service_id: 4, service_name: 'Half Cut', price_l1: 350 },
                ]);
            }

        } catch (error) {
            console.error(error);
            toast.error("Error loading vehicle data");
        } finally {
            setLoading(false);
        }
    }, [vin, navigate]);

    // Calculate Dynamic Fees
    const getPendingFees = () => {
        if (!vehicle) return [];
        const fees = [];

        // 1. Terminal Fee (If changed)
        if (draftConfig.terminal_id && String(draftConfig.terminal_id) !== String(vehicle.terminal_id)) {
            const terminal = terminals.find(t => String(t.id) === String(draftConfig.terminal_id));
            if (terminal) {
                // Find tariff: match vehicle location and terminal location code (e.g. SAV)
                const tariff = tariffs.find(tr => 
                    String(tr.origin_ref_id) === String(vehicle.location_id) && 
                    (tr.destination_name === terminal.location || tr.destination_ref_id === terminal.location)
                );
                if (tariff) {
                    fees.push({ label: `Internal Transport (${terminal.name})`, amount: Number(tariff.price_l1 || 0) });
                }
            }
        }

        // 2. Title Fee (If changed)
        const activeTitleSvc = services.find(s => s.service_category === 'TITLE');
        const activeTitleId = activeTitleSvc ? (activeTitleSvc.service_id || activeTitleSvc.id) : "";
        
        if (draftConfig.title_service_id && String(draftConfig.title_service_id) !== String(activeTitleId)) {
            const option = titleOptions.find(o => String(o.service_id) === String(draftConfig.title_service_id));
            if (option) {
                fees.push({ label: `Title Service: ${option.service_name}`, amount: Number(option.price_l1 || 0) });
            }
        }

        return fees;
    };

    const pendingFees = getPendingFees();

    useEffect(() => {
        if (!userLoading && user) {
            fetchVehicleData();
        }
    }, [user, userLoading, fetchVehicleData]);

    if (userLoading || (loading && !vehicle)) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    if (!vehicle) return <div className="p-10 text-center">Vehicle not found</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <ClientVehicleHeader vehicle={vehicle} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: Configuration Forms */}
                <div className="lg:col-span-2 space-y-6">
                    <ClientLogisticsForm
                        vehicle={vehicle}
                        services={services}
                        terminals={terminals}
                        destinations={destinations}
                        titleOptions={titleOptions}
                        dismantlingOptions={dismantlingOptions}
                        tariffs={tariffs}
                        onDraftChange={setDraftConfig}
                        onUpdate={fetchVehicleData}
                    />
                    
                    {/* NEW: Title Tracking for Clients */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <VehicleTitleTab 
                            vehicle={vehicle} 
                            isClient={true}
                            isLocked={vehicle?.current_status && !['purchased', 'pending'].includes(vehicle.current_status.toLowerCase())}
                            onUpdate={fetchVehicleData}
                        />
                    </div>
                </div>

                {/* Right side: Financial Summary */}
                <div className="lg:col-span-1 border rounded-lg overflow-hidden h-fit border-slate-200 sticky top-4 shadow-[0px_4px_16px_rgba(0,0,0,0.02)]">
                    <ClientFinancialCard 
                        vehicle={vehicle} 
                        pendingFees={pendingFees}
                    />
                </div>
            </div>
        </div>
    );
}
