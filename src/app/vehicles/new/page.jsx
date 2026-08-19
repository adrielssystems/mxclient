"use client";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import VehicleForm from '@/components/VehicleForm';
import useUser from '@/utils/useUser';

/**
 * Dedicated page for clients to add new vehicles using the unified, dense data-entry form.
 */
export default function NewClientVehiclePage() {
    const navigate = useNavigate();
    const { data: user, loading: userLoading } = useUser();
    const [loading, setLoading] = useState(true);

    const [auctions, setAuctions] = useState([]);
    const [locations, setLocations] = useState([]);
    const [terminals, setTerminals] = useState([]);
    const [destinations, setDestinations] = useState([]);
    const [titleServices, setTitleServices] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetches necessary data for the form dropdowns
                const [auctionsRes, locationsRes, terminalsRes, destinationsRes, titleServicesRes] = await Promise.all([
                    fetch('/api/admin/auctions'),
                    fetch('/api/locations'),
                    fetch('/api/admin/terminals'),
                    fetch('/api/admin/destinations'),
                    fetch('/api/admin/services/charges?category=TITLE')
                ]);

                if (auctionsRes.ok) {
                    const data = await auctionsRes.json();
                    setAuctions(data.auctions || []);
                }
                if (locationsRes.ok) {
                    const data = await locationsRes.json();
                    setLocations(data.locations || []);
                }
                if (terminalsRes.ok) {
                    const data = await terminalsRes.json();
                    setTerminals(data.terminals || []);
                }
                if (destinationsRes.ok) {
                    const data = await destinationsRes.json();
                    setDestinations(data.destinations || []);
                }
                if (titleServicesRes.ok) {
                    const data = await titleServicesRes.json();
                    setTitleServices(data.charges || []);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                toast.error('Error loading form data');
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchData();
    }, [user]);

    const handleSubmit = async (formData) => {
        try {
            // Extract file data before sending the main payload
            const { auctionReceiptBase64, gatePassBase64, ...vehicleData } = formData;

            const response = await fetch('/api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vehicleData)
            });

            if (response.ok) {
                const responseData = await response.json();
                const actualVin = responseData.vin || responseData.vehicle?.vin;
                
                let hasUploadErrors = false;
                
                // Upload Auction Receipt if present
                if (auctionReceiptBase64) {
                    try {
                        const receiptRes = await fetch(`/api/vehicles/${actualVin}/ownership-documents`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ base64: auctionReceiptBase64, tag: 'Auction Receipt' })
                        });
                        if (!receiptRes.ok) {
                            const errData = await receiptRes.json();
                            toast.error(`Auction receipt upload failed: ${errData.error || 'Too large or unknown error'}`);
                            hasUploadErrors = true;
                        } else {
                            toast.success('Auction receipt uploaded');
                        }
                    } catch (err) {
                        console.error('Auction receipt upload error:', err);
                        toast.error('Network error uploading auction receipt.');
                        hasUploadErrors = true;
                    }
                }

                // Upload Gate Pass if present
                if (gatePassBase64) {
                    try {
                        const gatePassRes = await fetch(`/api/vehicles/${actualVin}/ownership-documents`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ base64: gatePassBase64, tag: 'Gate Pass' })
                        });
                        if (!gatePassRes.ok) {
                            const errData = await gatePassRes.json();
                            toast.error(`Gate pass upload failed: ${errData.error || 'Too large or unknown error'}`);
                            hasUploadErrors = true;
                        } else {
                            toast.success('Gate pass uploaded');
                        }
                    } catch (err) {
                        console.error('Gate pass upload error:', err);
                        toast.error('Network error uploading gate pass.');
                        hasUploadErrors = true;
                    }
                }

                if (hasUploadErrors) {
                    toast.warning('Vehicle created, but some documents failed to upload. Please upload them manually from the vehicle details page.');
                } else {
                    toast.success('Vehicle created successfully');
                }
                navigate('/vehicles');
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to create vehicle');
            }
        } catch (error) {
            console.error('Error creating vehicle:', error);
            toast.error('Error creating vehicle');
        }
    };

    const handleCancel = () => {
        navigate('/');
    };

    if (userLoading || loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 overflow-auto">
            <VehicleForm
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                auctions={auctions}
                locations={locations}
                terminals={terminals}
                destinations={destinations}
                titleServices={titleServices}
                userRole="CLIENT"
                // Pre-assign the current client ID as default for the form
                initialData={{ client_id: user?.id }}
            />
        </div>
    );
}
