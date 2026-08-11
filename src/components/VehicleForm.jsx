import React, { useMemo, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, CheckCircle2, AlertCircle, Briefcase } from 'lucide-react';
import LocationCombobox from './LocationCombobox';
import { useTranslation } from 'react-i18next';

const getVehicleSchema = (isAdmin) => z.object({
    dealer: isAdmin
        ? z.enum(['AR', 'WI', '']).nullable().optional()
        : z.string().optional(),
    vin: z.string().length(17, "VIN must be 17 characters").toUpperCase(),
    purchase_date: z.string().min(1, "Required"),
    purchase_price: z.coerce.number().positive("Must be positive"),
    description: z.string().min(1, "Required"),
    client_id: z.string().min(1, "Required"),
    buyer_number: z.string().min(1, "Required"),
    auction_id: z.coerce.number().int().min(1, "Required"),
    location_id: z.coerce.number().int().min(1, "Required"),
    
    // Optional
    lot_number: z.string().optional().nullable(),
    pin_number: z.string().optional().nullable(),
    
    // Services
    wants_dispatch: z.boolean().default(false),
    destination_hub: z.string().optional().nullable(),
    specific_terminal_id: z.coerce.number().int().optional().nullable(),
    
    wants_shipping: z.boolean().default(false),
    shipping_destination_id: z.coerce.number().int().optional().nullable(),
    
    wants_title_service: z.boolean().default(false),
    title_service_id: z.coerce.number().int().optional().nullable()
});

export default function VehicleForm({ initialData, onSubmit, onCancel, clients, auctions, locations, terminals, destinations, titleServices, userRole, isClientView = false }) {
    const { t } = useTranslation();
    const isAdmin = userRole?.toUpperCase() === 'ADMIN';
    const isClient = userRole?.toUpperCase() === 'CLIENT' || isClientView;

    const {
        register,
        handleSubmit,
        control,
        setValue,
        getValues,
        formState: { errors, isSubmitting, isValid }
    } = useForm({
        resolver: zodResolver(getVehicleSchema(isAdmin)),
        defaultValues: initialData || {
            dealer: '',
            purchase_date: new Date().toISOString().split('T')[0],
            wants_dispatch: false,
            wants_shipping: false,
            wants_title_service: false,
            client_id: isClient ? clients?.[0]?.id : '' // Default to logged-in client if only one
        }
    });

    const wantsDispatch = useWatch({ control, name: 'wants_dispatch' });
    const wantsTitleService = useWatch({ control, name: 'wants_title_service' });
    const selectedHub = useWatch({ control, name: 'destination_hub' });
    const selectedAuctionId = useWatch({ control, name: 'auction_id' });

    const filteredLocations = useMemo(() => {
        if (!selectedAuctionId) return locations || [];
        return (locations || []).filter(l => l.auction_id == selectedAuctionId);
    }, [locations, selectedAuctionId]);

    // Reset location if the selected auction changes and the current location doesn't match
    React.useEffect(() => {
        const currentLocation = getValues('location_id');
        if (currentLocation && selectedAuctionId) {
            const loc = locations?.find(l => l.id == currentLocation);
            if (loc && loc.auction_id != selectedAuctionId) {
                setValue('location_id', null, { shouldValidate: true });
            }
        }
    }, [selectedAuctionId, locations, setValue, getValues]);

    const [auctionReceipt, setAuctionReceipt] = useState(null);
    const [gatePass, setGatePass] = useState(null);

    // Hubs Logic
    const uniqueHubs = useMemo(() => {
        const hubs = new Set();
        (terminals || []).forEach(t => {
            if (t.location) hubs.add(t.location);
        });
        return Array.from(hubs).sort();
    }, [terminals]);

    const filteredTerminals = useMemo(() => {
        if (!selectedHub) return [];
        return (terminals || []).filter(t => t.location === selectedHub || t.name.startsWith(selectedHub));
    }, [terminals, selectedHub]);

    // Handle form submission
    const onFormSubmit = (data) => {
        if (!initialData?.id && !auctionReceipt) {
            toast.error('Auction Receipt is mandatory to create a vehicle.');
            return;
        }
        onSubmit({ 
            ...data, 
            auctionReceiptBase64: auctionReceipt?.base64,
            gatePassBase64: gatePass?.base64
        });
    };

    const handleFileUpload = (e, setter) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
            toast.error('Only PDF documents are allowed');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setter({ name: file.name, base64: reader.result });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-6 py-3 border-b border-slate-300 flex items-center justify-between bg-white shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 border border-slate-200 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                            {initialData?.id ? t('add_vehicle.edit_vehicle') : t('add_vehicle.add_new_vehicle')}
                        </h2>
                    </div>
                </div>
            </div>

            {/* Main Form Content */}
            <div className="flex-1 overflow-auto p-4 lg:p-6 bg-slate-50">
                <form id="vehicle-form" onSubmit={handleSubmit(onFormSubmit)} className="max-w-[1400px] mx-auto space-y-6">
                    
                    {/* SECTION: MANDATORY INFO (Dense Grid) */}
                    <div className="bg-white border border-slate-300 rounded shadow-sm">
                        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-100/80 flex items-center justify-between">
                            <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <Briefcase className="h-3.5 w-3.5" />
                                {t('add_vehicle.mandatory_vehicle_data')}
                            </h3>
                        </div>
                        
                        <div className="p-5 space-y-5">
                            {/* Row 1: Dealer, VIN, Date, Price */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {isAdmin && (
                                    <div>
                                        <label htmlFor="dealer" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.dealer_license')} <span className="text-red-500">*</span></label>
                                        <select id="dealer" {...register('dealer')} className={`w-full px-3 py-1.5 bg-white border rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${errors.dealer ? 'border-red-400' : 'border-slate-300'}`}>
                                            <option value="">{t('add_vehicle.select_dealer')}</option>
                                            <option value="AR">AR — MotorX (Arkansas)</option>
                                            <option value="WI">WI — MotorX (Wisconsin)</option>
                                            <option value="">N/A — External Vehicle</option>
                                        </select>
                                        {errors.dealer && <p className="mt-1 text-[10px] text-red-500">{errors.dealer.message}</p>}
                                    </div>
                                )}
                                <div className={isAdmin ? "" : "md:col-span-2"}>
                                    <label htmlFor="vin" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.vin')} <span className="text-red-500">*</span></label>
                                    <input 
                                        id="vin"
                                        {...register('vin')} 
                                        placeholder={t('add_vehicle.vin_placeholder')} 
                                        className={`w-full px-3 py-1.5 bg-white border rounded text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.vin ? 'border-red-400' : 'border-slate-300'}`}
                                        maxLength={17}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="purchase_date" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.purchase_date')} <span className="text-red-500">*</span></label>
                                    <input id="purchase_date" {...register('purchase_date')} type="date" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div className={isAdmin ? "" : "md:col-span-1"}>
                                    <label htmlFor="purchase_price" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.purchase_price')} <span className="text-red-500">*</span></label>
                                    <input id="purchase_price" {...register('purchase_price')} type="number" step="0.01" placeholder="0.00" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            {/* Row 2: Description */}
                            <div>
                                <label htmlFor="description" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.description')} <span className="text-red-500">*</span></label>
                                <input id="description" {...register('description')} placeholder={t('add_vehicle.description_placeholder')} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>

                            {/* Row 3: Client, Buyer #, Lot #, PIN # */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label htmlFor="client_id" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.client')} <span className="text-red-500">*</span></label>
                                    <select 
                                        id="client_id"
                                        {...register('client_id')} 
                                        disabled={isClient}
                                        className={`w-full px-3 py-1.5 text-sm font-bold border rounded focus:ring-2 focus:ring-blue-500 outline-none ${isClient ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-300'}`}
                                    >
                                        <option value="">{t('add_vehicle.select_client')}</option>
                                        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="buyer_number" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.buyer_number')} <span className="text-red-500">*</span></label>
                                    <input id="buyer_number" {...register('buyer_number')} placeholder={t('add_vehicle.buyer_placeholder')} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label htmlFor="lot_number" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.lot_number')}</label>
                                    <input id="lot_number" {...register('lot_number')} placeholder={t('add_vehicle.optional')} className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label htmlFor="pin_number" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.pin_number')}</label>
                                    <input id="pin_number" {...register('pin_number')} placeholder={t('add_vehicle.optional')} className="w-full px-3 py-1.5 bg-slate-50/50 border border-slate-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            {/* Row 4: Auction & Current Location */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="auction_id" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.auction')} <span className="text-red-500">*</span></label>
                                    <select id="auction_id" {...register('auction_id')} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                                        <option value="">{t('add_vehicle.select_auction')}</option>
                                        {auctions?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="location_id" className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{t('add_vehicle.current_location')} <span className="text-red-500">*</span></label>
                                    <Controller
                                        name="location_id"
                                        control={control}
                                        render={({ field }) => (
                                            <LocationCombobox
                                                items={filteredLocations}
                                                value={field.value}
                                                onChange={field.onChange}
                                                hasError={!!errors.location_id}
                                            />
                                        )}
                                    />
                                    {errors.location_id && <p className="mt-1 text-[10px] text-red-500">{errors.location_id.message}</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION: ADDITIONAL SERVICES (Vertical List with Horizontal Alignment) */}
                    <div className="bg-white border border-slate-300 rounded shadow-sm overflow-hidden">
                        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-100/80">
                            <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                                {t('add_vehicle.documents_and_services')}
                            </h3>
                        </div>
                        
                        <div className="divide-y divide-slate-100 flex flex-col">
                            
                            {/* SERVICE 1: TRANSPORT */}
                            <div className="p-4 hover:bg-slate-50/50 transition-colors">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    <div className="md:col-span-5 flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="transport-check"
                                            {...register('wants_dispatch')} 
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                        />
                                        <label htmlFor="transport-check" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                                            {isClient ? t('configure_services.do_you_want_motorx_to_transport') || "Do you want MOTOR X to transport the vehicle for you?" : t('configure_services.dispatch_service') || "Dispatch Service"}
                                        </label>
                                    </div>
                                    <div className="md:col-span-7">
                                        {wantsDispatch && (
                                            <div className="flex flex-row items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                                <select id="destination_hub" {...register('destination_hub')} className="flex-1 px-4 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                                                    <option value="">{t('add_vehicle.destination_hub')}...</option>
                                                    {uniqueHubs.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                <select id="specific_terminal_id" {...register('specific_terminal_id')} className="flex-1 px-4 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" disabled={!selectedHub}>
                                                    <option value="">{t('configure_services.select_terminal')}</option>
                                                    {filteredTerminals.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* SERVICE 3: TITLES */}
                            <div className="p-4 hover:bg-slate-50/50 transition-colors">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                    <div className="md:col-span-5 flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            id="titles-check"
                                            {...register('wants_title_service')} 
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                        />
                                        <label htmlFor="titles-check" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                                            {isClient ? t('configure_services.do_you_have_problem_with_documents') || "Do you have a problem with documents? Select what you need" : t('configure_services.title_services_form')}
                                        </label>
                                    </div>
                                    <div className="md:col-span-7">
                                        {wantsTitleService && (
                                            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                                <select id="title_service_id" {...register('title_service_id')} className="w-full px-4 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                                    <option value="">{t('add_vehicle.select_title_service')}</option>
                                                    {titleServices?.map(s => <option key={s.service_id} value={s.service_id}>{s.service_name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
 
                        </div>
                    </div>

                    {/* SECTION: UPLOADS (Auction Receipt & Gate Pass) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {/* Auction Receipt */}
                        <div className="relative bg-white border border-slate-300 rounded shadow-sm p-5">
                            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest mb-3">
                                {t('add_vehicle.upload_auction_receipt')} <span className="text-red-500">({t('add_vehicle.required_to_create')})</span>
                            </label>
                            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors relative ${auctionReceipt ? 'border-emerald-300 bg-emerald-50' : 'border-blue-200 hover:bg-blue-50'}`}>
                                <input 
                                    type="file" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => handleFileUpload(e, setAuctionReceipt)}
                                    accept=".pdf"
                                />
                                {auctionReceipt ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                        <span className="text-sm font-bold text-slate-700">{auctionReceipt.name}</span>
                                        <span className="text-xs text-emerald-600 font-bold">Ready to upload</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                        <span className="text-sm font-bold text-slate-600">{t('add_vehicle.upload_auction_receipt')} ({t('add_vehicle.pdf_only')})</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Gate Pass */}
                        <div className="relative bg-white border border-slate-300 rounded shadow-sm p-5">
                            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-widest mb-3">
                                {t('add_vehicle.upload_gate_pass')} <span className="text-slate-400">({t('add_vehicle.optional')})</span>
                            </label>
                            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors relative ${gatePass ? 'border-emerald-300 bg-emerald-50' : 'border-blue-200 hover:bg-blue-50'}`}>
                                <input 
                                    type="file" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={(e) => handleFileUpload(e, setGatePass)}
                                    accept=".pdf"
                                />
                                {gatePass ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                        <span className="text-sm font-bold text-slate-700">{gatePass.name}</span>
                                        <span className="text-xs text-emerald-600 font-bold">Ready to upload</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                        <span className="text-sm font-bold text-slate-600">{t('add_vehicle.upload_gate_pass')} ({t('add_vehicle.pdf_only')})</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* FORM ALERTS */}
                    {!isValid && Object.keys(errors).length > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs font-bold uppercase tracking-wider animate-pulse transition-all">
                            <AlertCircle className="h-4 w-4" />
                            Please complete all mandatory fields marked with * to enable submission
                        </div>
                    )}

                </form>
            </div>

            {/* Sticky Actions Bar */}
            <div className="p-4 border-t border-slate-300 bg-white flex justify-end gap-3 shrink-0 shadow-lg">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-6 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest"
                >
                    {t('add_vehicle.cancel')}
                </button>
                <button
                    form="vehicle-form"
                    type="submit"
                    disabled={isSubmitting || !isValid}
                    className={`px-8 py-2 text-xs font-black text-white rounded transition-all active:scale-95 space-x-2 uppercase tracking-widest
                        ${!isValid || isSubmitting 
                            ? 'bg-slate-300 cursor-not-allowed' 
                            : 'bg-slate-800 hover:bg-slate-900 shadow-md'}
                    `}
                >
                    {isSubmitting ? t('add_vehicle.saving') : (initialData?.id ? t('add_vehicle.edit_vehicle') : t('add_vehicle.create_vehicle'))}
                </button>
            </div>
        </div>
    );
}
