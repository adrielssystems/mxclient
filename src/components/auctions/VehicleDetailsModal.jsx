import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calculator, MapPin, Settings, Info, Gauge, ShieldCheck, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function VehicleDetailsModal({ vehicle, onClose, formatCurrency }) {
  const [activeTab, setActiveTab] = useState('gallery'); // gallery, details, calculator
  const [freightCost, setFreightCost] = useState(0);
  const [destinations, setDestinations] = useState([]);
  const [loadingDestinations, setLoadingDestinations] = useState(true);

  // Fetch real destinations from development Appmx2
  useEffect(() => {
    fetch('http://localhost:3000/api/client/destinations')
      .then(res => res.json())
      .then(data => {
        if (data && data.destinations) {
          setDestinations(data.destinations);
          // Set a default freight cost algorithm based on destination id
          if (data.destinations.length > 0) {
            setFreightCost(calculateEstimatedFreight(data.destinations[0].id));
          }
        }
      })
      .catch(err => console.error("Error fetching destinations:", err))
      .finally(() => setLoadingDestinations(false));
  }, []);

  // Temporary mock algorithm until the full tariff calculator is exposed
  const calculateEstimatedFreight = (destId) => {
    // Generate a deterministic but fake cost based on ID just for the UI
    return 500 + (destId * 50);
  };
  
  const allImages = [vehicle.primaryImageUrl, ...(vehicle.additionalImageUrls || [])];
  const [imgIndex, setImgIndex] = useState(0);

  const nextImage = () => setImgIndex((prev) => (prev + 1) % allImages.length);
  const prevImage = () => setImgIndex((prev) => (prev - 1 + allImages.length) % allImages.length);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-full overflow-hidden relative z-10 flex flex-col md:flex-row"
      >
        {/* LEFT PANEL: IMAGE GALLERY */}
        <div className="w-full md:w-3/5 bg-slate-900 relative flex flex-col group">
          <div className="relative flex-1 flex items-center justify-center overflow-hidden min-h-[300px] md:min-h-0">
            <AnimatePresence mode="wait">
              <motion.img 
                key={imgIndex}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                src={allImages[imgIndex]} 
                alt="Vehicle Preview" 
                className="w-full h-full object-cover"
              />
            </AnimatePresence>
            
            {/* Gallery Controls */}
            {allImages.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={nextImage} className="absolute right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all opacity-0 group-hover:opacity-100">
                  <ChevronRight className="w-6 h-6" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/50 text-white text-xs font-bold rounded-full backdrop-blur-md">
                  {imgIndex + 1} / {allImages.length}
                </div>
              </>
            )}
            
            <button onClick={onClose} className="md:hidden absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full backdrop-blur-md">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Thumbnail Strip */}
          <div className="h-24 bg-black p-2 flex gap-2 overflow-x-auto hide-scrollbar snap-x">
            {allImages.map((img, idx) => (
              <button 
                key={idx}
                onClick={() => setImgIndex(idx)}
                className={`flex-shrink-0 w-32 h-full rounded-md overflow-hidden border-2 transition-all snap-start ${imgIndex === idx ? 'border-motorx-red opacity-100' : 'border-transparent opacity-50 hover:opacity-100'}`}
              >
                <img src={img} className="w-full h-full object-cover" alt="Thumb" />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: INFO & CALCULATOR */}
        <div className="w-full md:w-2/5 bg-slate-50 flex flex-col max-h-[80vh] md:max-h-none overflow-y-auto">
          {/* Header */}
          <div className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-motorx-red/10 text-motorx-red px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider">
                  {vehicle.condition}
                </span>
                <span className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-3 h-3" /> {vehicle.auctionVendor}
                </span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">
                {vehicle.year} {vehicle.makeName} {vehicle.modelName}
              </h2>
              <p className="text-slate-500 text-sm font-medium mt-1">{vehicle.seriesName} • {vehicle.mileage?.toLocaleString()} mi</p>
            </div>
            <button onClick={onClose} className="hidden md:flex p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 px-6 bg-white">
            <button 
              onClick={() => setActiveTab('details')}
              className={`py-4 px-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'details' ? 'border-motorx-red text-motorx-red' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Vehicle Details
            </button>
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`py-4 px-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'calculator' ? 'border-motorx-red text-motorx-red' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Calculator className="w-4 h-4" /> Cost Calc
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 flex-1 overflow-y-auto">
            {activeTab === 'details' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <Gauge className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-wider">Odometer</span>
                    </div>
                    <p className="text-slate-900 font-bold">{vehicle.mileage?.toLocaleString()} mi</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <Settings className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-wider">VIN</span>
                    </div>
                    <p className="text-slate-900 font-bold text-sm">{vehicle.vehicleId}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-500" />
                    <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Specs & Info</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-slate-500">Engine</span>
                      <span className="font-medium text-slate-900">{vehicle.engineName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-slate-500">Transmission</span>
                      <span className="font-medium text-slate-900">{vehicle.transmission || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-slate-500">Exterior Color</span>
                      <span className="font-medium text-slate-900">{vehicle.exteriorColor || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3 text-sm">
                      <span className="text-slate-500">Interior Color</span>
                      <span className="font-medium text-slate-900">{vehicle.interiorColor || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 shadow-sm">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-emerald-800 font-bold text-sm mb-1">MotorX Verified Listing</h4>
                    <p className="text-emerald-600/80 text-xs leading-relaxed">This vehicle data has been retrieved directly from {vehicle.auctionVendor} real-time APIs. Condition reports and structural guarantees apply as per vendor policies.</p>
                  </div>
                </div>

              </motion.div>
            )}

            {activeTab === 'calculator' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-motorx-red rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Current Bid</p>
                  <p className="text-4xl font-black mb-4">{formatCurrency(vehicle.currentHighBid)}</p>
                  
                  {vehicle.buyNowPrice > 0 && (
                    <div className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-lg">
                      <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Buy Now Available</p>
                      <p className="text-sm font-bold text-white">{formatCurrency(vehicle.buyNowPrice)}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-motorx-red" /> Estimate All-In Cost
                  </h4>
                  
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Vehicle Price</span>
                      <span className="font-bold text-slate-900">{formatCurrency(vehicle.currentHighBid)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Auction Fees (Est. 5%)</span>
                      <span className="font-bold text-slate-900">{formatCurrency(vehicle.currentHighBid * 0.05)}</span>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Destination Port</label>
                      <select 
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-motorx-red focus:border-motorx-red outline-none transition-all"
                        value={destinations.findIndex(d => calculateEstimatedFreight(d.id) === freightCost) !== -1 ? destinations.find(d => calculateEstimatedFreight(d.id) === freightCost).id : ""}
                        onChange={(e) => setFreightCost(calculateEstimatedFreight(Number(e.target.value)))}
                        disabled={loadingDestinations}
                      >
                        {loadingDestinations ? (
                          <option>Cargando puertos reales...</option>
                        ) : (
                          destinations.map(dest => (
                            <option key={dest.id} value={dest.id}>
                              {dest.country_name} - {dest.port_name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-2">
                      <span className="text-slate-500">MotorX Freight</span>
                      <span className="font-bold text-slate-900">{formatCurrency(freightCost)}</span>
                    </div>
                  </div>

                  <div className="bg-motorx-red/5 border border-motorx-red/20 rounded-xl p-5 flex justify-between items-center shadow-sm">
                    <span className="font-black text-slate-900 uppercase tracking-wide">Total Landed</span>
                    <span className="text-2xl font-black text-motorx-red">
                      {formatCurrency(vehicle.currentHighBid + (vehicle.currentHighBid * 0.05) + freightCost)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-6 bg-white border-t border-slate-200 mt-auto">
            <button className="w-full bg-motorx-red hover:bg-motorx-red-dark text-white py-4 rounded-xl text-sm font-black shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex justify-center items-center gap-2 uppercase tracking-wide">
              Submit Offer <CheckCircle2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
