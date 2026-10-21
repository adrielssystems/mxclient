import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calculator, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Gavel, 
  DollarSign, 
  Zap, 
  ShieldAlert, 
  TrendingUp, 
  ArrowRight,
  Star,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateBuyFee } from '@/utils/buyFeeCalculator';
import BuyFeeScheduleModal from './BuyFeeScheduleModal';

export default function VehicleDetailsModal({ vehicle, onClose, formatCurrency, similarVehicles, onSelectVehicle }) {
  const [activeTab, setActiveTab] = useState('bidding'); // bidding, details, calculator
  const [freightCost, setFreightCost] = useState(0);
  const [destinations, setDestinations] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);
  const [showBuyFeeModal, setShowBuyFeeModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState('...');
  const [imgIndex, setImgIndex] = useState(0);

  // Vehicle Bidding PDF state
  const [proxyBidInput, setProxyBidInput] = useState('');
  const [existingBid, setExistingBid] = useState(null);
  const [loadingExistingBid, setLoadingExistingBid] = useState(true);
  const [collisionWarning, setCollisionWarning] = useState(null); // When another client bid higher
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // All Images array declared upfront so useEffect hooks can safely reference it
  const allImages = [
    vehicle.primaryImageUrl,
    ...(vehicle.additionalImageUrls || [])
  ].filter(Boolean);

  // Helper to format pure integer with thousand separators
  const formatInteger = (val) => {
    if (val === undefined || val === null || val === '') return '';
    const num = Math.round(Number(String(val).replace(/[^0-9]/g, '')) || 0);
    return num > 0 ? num.toLocaleString('en-US') : '';
  };

  // Calculate standard auction increment based on price tier
  const getBidIncrement = (currentPrice) => {
    const price = Math.round(Number(currentPrice) || 0);
    if (price < 1000) return 50;
    if (price < 5000) return 100;
    if (price < 15000) return 250;
    if (price < 30000) return 500;
    return 1000;
  };

  const basePrice = Math.round(existingBid ? Number(existingBid.max_proxy_bid) : (Number(vehicle.currentHighBid) || 0));
  const currentIncrement = getBidIncrement(basePrice);
  const minBidAllowed = basePrice + currentIncrement;

  // Timer logic
  useEffect(() => {
    if (!vehicle.auctionEndDate) {
       setTimeLeft('Buy Now Only');
       return;
    }
    const updateTimer = () => {
      const now = new Date();
      const diff = vehicle.auctionEndDate - now;
      if (diff <= 0) {
        setTimeLeft('Ended');
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        
        if (days > 0) setTimeLeft(`${days}d ${hours}h`);
        else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m`);
        else setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };
    
    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [vehicle.auctionEndDate]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowLeft' && allImages.length > 1) {
        setImgIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
      } else if (e.key === 'ArrowRight' && allImages.length > 1) {
        setImgIndex((prev) => (prev + 1) % allImages.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, allImages.length]);

  // Fetch real destinations & existing proxy bid from auctions_db
  useEffect(() => {
    // 1. Destinations
    fetch('/api/client/destinations')
      .then(res => res.json())
      .then(data => {
        if (data && data.destinations) {
          setDestinations(data.destinations);
          if (data.destinations.length > 0) {
            setSelectedDestination(data.destinations[0]);
            setFreightCost(calculateEstimatedFreight(data.destinations[0].id));
          }
        }
      })
      .catch(err => console.error("Error fetching destinations:", err))
      .finally(() => setLoadingDestinations(false));

    // 2. Fetch existing proxy bid for this VIN
    if (vehicle.vin) {
      fetch(`/api/auctions/bids?vin=${encodeURIComponent(vehicle.vin)}`)
        .then(res => res.json())
        .then(data => {
          if (data?.bid) {
            setExistingBid(data.bid);
            const prevBid = Math.round(Number(data.bid.max_proxy_bid) || 0);
            const inc = getBidIncrement(prevBid);
            setProxyBidInput(formatInteger(prevBid + inc));
          } else {
            const currentBid = Math.round(Number(vehicle.currentHighBid) || 0);
            const inc = getBidIncrement(currentBid);
            const suggested = currentBid > 0 ? (currentBid + inc) : 500;
            setProxyBidInput(formatInteger(suggested));
          }
        })
        .catch(err => {
          console.error("Error fetching existing bid:", err);
          const currentBid = Math.round(Number(vehicle.currentHighBid) || 0);
          const inc = getBidIncrement(currentBid);
          const suggested = currentBid > 0 ? (currentBid + inc) : 500;
          setProxyBidInput(formatInteger(suggested));
        })
        .finally(() => setLoadingExistingBid(false));

      // 3. Check wishlist
      fetch(`/api/auctions/wishlist`)
        .then(res => res.json())
        .then(data => {
          if (data?.wishlist?.some(w => w.vin === vehicle.vin)) {
            setIsWishlisted(true);
          }
        })
        .catch(err => console.error("Error fetching wishlist:", err));
    }
  }, [vehicle.vin]);

  const calculateEstimatedFreight = (destId) => {
    switch (destId) {
      case 1: return 850;
      case 2: return 950;
      case 3: return 1200;
      default: return 750;
    }
  };

  // Strictly integer parsed amount (no decimals / non-rationals)
  const parsedBid = Math.round(Number(proxyBidInput.replace(/[^0-9]/g, '')) || 0);
  const isValidBid = parsedBid > 0 && parsedBid >= minBidAllowed && (!existingBid || parsedBid > Number(existingBid.max_proxy_bid));

  // Handle Proxy Bid Submission
  const handlePlaceProxyBid = async () => {
    if (!isValidBid) return;
    setIsSubmittingBid(true);
    setCollisionWarning(null);

    try {
      const payload = {
        vin: vehicle.vin,
        lot_number: vehicle.lotNumber || vehicle.lotId || vehicle.vehicleId,
        auction_source: vehicle.auctionSource || 'ADESA',
        auction_location: vehicle.location || vehicle.auctionLocation || null,
        max_proxy_bid: parsedBid,
        destination_id: selectedDestination?.id || null,
        destination_port: selectedDestination ? `${selectedDestination.country_name} - ${selectedDestination.port_name}` : null,
        raw_vehicle_details: {
          odometer: vehicle.odometerReading,
          damage: vehicle.damageType || vehicle.primaryDamage,
          primaryImageUrl: vehicle.primaryImageUrl,
          year: vehicle.year,
          make: vehicle.makeName,
          model: vehicle.modelName,
          drivable: vehicle.drivable,
          saleChannels: vehicle.saleChannels,
          lane: vehicle.lane,
          runNumber: vehicle.runNumber
        }
      };

      const res = await fetch('/api/auctions/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(existingBid ? 'Proxy Bid Increased!' : 'Maximum Proxy Bid Placed!', {
          description: data.message || `Authorized limit: ${formatCurrency(parsedBid)}`
        });
        setExistingBid(data.bid);
        setCollisionWarning(null);
      } else if (res.status === 409 && data.code === 'MX_OUTBID_COLLISION') {
        // PDF Section 2 Rule: Internal client collision
        setCollisionWarning(data.error);
        toast.error('Bid Conflict Between Motor X Customers', {
          description: data.error
        });
      } else {
        toast.error('Unable to submit bid', {
          description: data.error || 'Please verify your bid amount.'
        });
      }
    } catch (err) {
      console.error("Submit proxy bid error:", err);
      toast.error('Network error', { description: 'Please check your connection and try again.' });
    } finally {
      setIsSubmittingBid(false);
    }
  };

  // Toggle Watchlist
  const handleToggleWishlist = async () => {
    try {
      if (isWishlisted) {
        await fetch(`/api/auctions/wishlist?vin=${encodeURIComponent(vehicle.vin)}`, { method: 'DELETE' });
        setIsWishlisted(false);
        toast.info("Removed from Watchlist");
      } else {
        await fetch('/api/auctions/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vin: vehicle.vin,
            auction_source: vehicle.auctionSource || 'ADESA',
            lot_number: vehicle.lotNumber || vehicle.lotId,
            raw_details: {
              year: vehicle.year,
              make: vehicle.makeName || vehicle.make,
              makeName: vehicle.makeName || vehicle.make,
              model: vehicle.modelName || vehicle.model,
              modelName: vehicle.modelName || vehicle.model,
              seriesName: vehicle.seriesName || vehicle.trim || '',
              primaryImageUrl: vehicle.primaryImageUrl,
              additionalImageUrls: vehicle.additionalImageUrls || [],
              currentHighBid: vehicle.currentHighBid || vehicle.startingBid || 0,
              buyNowPrice: vehicle.buyNowPrice || null,
              mileage: vehicle.mileage || vehicle.odometerReading || 0,
              condition: vehicle.condition || 'Clean Title',
              auctionVendor: vehicle.auctionVendor || vehicle.auctionSource || 'ADESA',
              auctionSource: vehicle.auctionSource || 'ADESA',
              modalities: vehicle.modalities || ['Live Auction'],
              isBestDeal: vehicle.isBestDeal || false,
              aiScore: vehicle.aiScore || null,
              auctionEndDate: vehicle.auctionEndDate || null,
              drivable: vehicle.drivable
            }
          })
        });
        setIsWishlisted(true);
        toast.success("Saved to Watchlist");
      }
    } catch (e) {
      console.error("Watchlist toggle error:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col md:flex-row overflow-hidden border border-slate-200"
      >
        {/* LEFT PANEL: MEDIA & SPECS (Compact layout per PDF Section 1) */}
        <div className="w-full md:w-3/5 bg-slate-900 flex flex-col h-[320px] md:h-auto border-r border-slate-800">
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden group">
            {allImages.length > 0 ? (
              <img 
                src={allImages[imgIndex]} 
                alt={`${vehicle.year} ${vehicle.makeName}`} 
                onClick={() => setIsLightboxOpen(true)}
                className="w-full h-full object-contain max-h-[500px] cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                title="Click to expand full size"
              />
            ) : (
              <div className="text-slate-500 font-bold">No images available</div>
            )}

            {/* Click to expand hover hint */}
            {allImages.length > 0 && (
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-all opacity-80 hover:opacity-100 flex items-center gap-1.5 text-xs font-semibold px-3"
                title="View Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Zoom</span>
              </button>
            )}

            {/* Watchlist Button (Star Icon - Auction Industry Standard) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleWishlist();
              }}
              className={`absolute top-4 left-4 z-20 px-3 py-1.5 rounded-lg backdrop-blur-md transition-all shadow-lg flex items-center gap-1.5 text-xs font-bold ${
                isWishlisted 
                  ? 'bg-amber-400 text-slate-950 border border-amber-300' 
                  : 'bg-black/60 text-white hover:bg-black/80 border border-white/20'
              }`}
              title={isWishlisted ? "Remove from Watchlist" : "Add to Watchlist"}
            >
              <Star className={`w-4 h-4 ${isWishlisted ? 'fill-current text-slate-950' : 'text-amber-400'}`} />
              <span>{isWishlisted ? 'In Watchlist' : 'Watchlist'}</span>
            </button>

            {/* Navigation arrows */}
            {allImages.length > 1 && (
              <>
                <button 
                  onClick={() => setImgIndex((imgIndex - 1 + allImages.length) % allImages.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setImgIndex((imgIndex + 1) % allImages.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Image counter */}
            <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/70 text-white text-xs font-bold rounded-full">
              {imgIndex + 1} / {allImages.length}
            </div>
          </div>

          {/* Thumbnail Strip */}
          <div className="h-20 bg-slate-950 p-2 flex gap-2 overflow-x-auto hide-scrollbar snap-x border-t border-slate-800">
            {allImages.map((img, idx) => (
              <button 
                key={idx}
                onClick={() => setImgIndex(idx)}
                className={`flex-shrink-0 w-24 h-full rounded-md overflow-hidden border-2 transition-all snap-start ${imgIndex === idx ? 'border-motorx-red opacity-100' : 'border-transparent opacity-40 hover:opacity-100'}`}
              >
                <img src={img} className="w-full h-full object-cover" alt="Thumb" />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: ACTIONS, BIDDING, & FEES */}
        <div className="w-full md:w-2/5 bg-slate-50 flex flex-col h-full max-h-[92vh]">
          {/* Header */}
          <div className="p-5 bg-white border-b border-slate-200 sticky top-0 z-10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-motorx-red/10 text-motorx-red px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider">
                  {(vehicle.condition || 'LIVE AUCTION').replace(/_/g, ' ')}
                </span>
                <span className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-3 h-3" /> {vehicle.auctionVendor || vehicle.location || 'ADESA'}
                </span>
                <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold border ${timeLeft === 'Ended' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-red-50 text-motorx-red border-red-100'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeLeft}</span>
                </div>
              </div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">
                {vehicle.year} {vehicle.makeName} {vehicle.modelName}
              </h2>
              <p className="text-slate-500 text-xs font-semibold mt-0.5">VIN: <span className="font-mono text-slate-700">{vehicle.vin}</span> • {vehicle.mileage?.toLocaleString()} mi</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 px-5 bg-white">
            <button 
              onClick={() => setActiveTab('bidding')}
              className={`py-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'bidding' ? 'border-motorx-red text-motorx-red' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Gavel className="w-3.5 h-3.5" /> Proxy Bidding
            </button>
            <button 
              onClick={() => setActiveTab('details')}
              className={`py-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === 'details' ? 'border-motorx-red text-motorx-red' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              Vehicle Details
            </button>
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`py-3 px-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'calculator' ? 'border-motorx-red text-motorx-red' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <Calculator className="w-3.5 h-3.5" /> Cost Breakdown
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {activeTab === 'bidding' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Current Market & Bid Box */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Auction Bid</span>
                    <span className="text-2xl font-black text-slate-900">
                      {formatCurrency(vehicle.currentHighBid || 0)}
                    </span>
                  </div>

                  {existingBid && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">My Maximum Proxy Bid</span>
                        <span className="text-lg font-black text-slate-800">{formatCurrency(existingBid.max_proxy_bid)}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${existingBid.status === 'WINNING' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                        {existingBid.status === 'WINNING' ? 'Winning (MotorX Priority)' : existingBid.status}
                      </span>
                    </div>
                  )}

                  {/* Buy It Now Option if available (Section 5) */}
                  {vehicle.buyNowPrice && vehicle.buyNowPrice > 0 && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> Buy It Now Price
                        </span>
                        <span className="text-xl font-black text-slate-900">{formatCurrency(vehicle.buyNowPrice)}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => toast.info("Buy It Now purchase flow initiating...")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-lg shadow transition-all cursor-pointer"
                      >
                        Buy It Now {formatCurrency(vehicle.buyNowPrice)}
                      </button>
                    </div>
                  )}
                </div>

                {/* Internal Motor X Collision Alert (Section 2 of PDF) */}
                {collisionWarning && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Another Motor X Customer Has Bid</h4>
                        <p className="text-xs text-amber-800 mt-1 leading-relaxed">{collisionWarning}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setCollisionWarning(null)}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-50 transition-all uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const inputEl = document.getElementById('proxyBidInputField');
                          if (inputEl) inputEl.focus();
                        }}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-all uppercase shadow-sm"
                      >
                        Increase Bid
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Maximum Proxy Bid Form (Section 2) */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {existingBid ? 'Increase Maximum Proxy Bid' : 'Maximum Proxy Bid'}
                  </label>
                  <div className="relative">
                    <DollarSign className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      id="proxyBidInputField"
                      type="text"
                      inputMode="numeric"
                      placeholder={`Min: $${formatInteger(minBidAllowed)}`}
                      value={proxyBidInput}
                      onKeyDown={(e) => {
                        // Allow navigation, backspace, delete, tab
                        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                          return;
                        }
                        // Disallow non-digits (minus, plus, decimal point, comma, e)
                        if (!/^[0-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        // Sanitize to only digits and format with thousand separators
                        const rawDigits = e.target.value.replace(/[^0-9]/g, '');
                        if (!rawDigits) {
                          setProxyBidInput('');
                        } else {
                          const num = parseInt(rawDigits, 10);
                          setProxyBidInput(num.toLocaleString('en-US'));
                        }
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-motorx-red focus:border-motorx-red outline-none transition-all"
                    />
                  </div>

                  {/* Suggested Quick Bids / Increments */}
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Suggested:</span>
                    <button
                      type="button"
                      onClick={() => setProxyBidInput(formatInteger(minBidAllowed))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all"
                    >
                      ${formatInteger(minBidAllowed)} (Min +${formatInteger(currentIncrement)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setProxyBidInput(formatInteger(minBidAllowed + currentIncrement))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all"
                    >
                      +${formatInteger(currentIncrement)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProxyBidInput(formatInteger(minBidAllowed + (currentIncrement * 2)))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all"
                    >
                      +${formatInteger(currentIncrement * 2)}
                    </button>
                  </div>

                  {/* Required Legal Disclaimers (Exact wording from Section 2 of PDF) */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-normal">
                    <p className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>Your Maximum Proxy Bid applies to the vehicle purchase price only. Auction fees and Motor X charges are additional.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>Once submitted, your Maximum Proxy Bid cannot be reduced or canceled. You may increase it at any time before bidding closes.</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'details' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block">Lot / Listing</span>
                    <span className="font-bold text-slate-800">{vehicle.lotNumber || vehicle.lotId || 'N/A'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block">Auction Source</span>
                    <span className="font-bold text-slate-800">{vehicle.auctionSource || 'ADESA'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block">Primary Damage</span>
                    <span className="font-bold text-slate-800">{vehicle.primaryDamage || vehicle.damageType || 'None'}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block">Run & Drive</span>
                    <span className="font-bold text-slate-800">{vehicle.drivable ? 'Yes' : 'No / Stationary'}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'calculator' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Estimated Purchase</span>
                    <span className="font-bold text-slate-900">{formatCurrency(parsedBid || vehicle.currentHighBid || 0)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Auction Buy Fee</span>
                    <span className="font-bold text-slate-900">{formatCurrency(calculateBuyFee(parsedBid || vehicle.currentHighBid || 0))}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Estimated Freight</span>
                    <span className="font-bold text-slate-900">{formatCurrency(freightCost)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-motorx-red">
                    <span>Estimated Landed</span>
                    <span>{formatCurrency((parsedBid || vehicle.currentHighBid || 0) + calculateBuyFee(parsedBid || vehicle.currentHighBid || 0) + freightCost)}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Action (PLACE BID or INCREASE BID) */}
          <div className="p-5 bg-white border-t border-slate-200 mt-auto">
            <button 
              type="button"
              onClick={handlePlaceProxyBid}
              disabled={!isValidBid || isSubmittingBid}
              className={`w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex justify-center items-center gap-2 cursor-pointer ${
                isValidBid && !isSubmittingBid 
                  ? 'bg-motorx-red hover:bg-motorx-red-dark text-white hover:shadow-xl hover:-translate-y-0.5' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmittingBid ? (
                <>Recording Bid...</>
              ) : existingBid ? (
                <>Increase Bid <TrendingUp className="w-4 h-4" /></>
              ) : (
                <>Place Bid <CheckCircle2 className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Buy Fee Tier Schedule Modal */}
      <BuyFeeScheduleModal
        isOpen={showBuyFeeModal}
        onClose={() => setShowBuyFeeModal(false)}
        currentAmount={parsedBid || vehicle.currentHighBid || 0}
      />

      {/* FULLSCREEN LIGHTBOX MODAL (Portaled directly to body to guarantee z-index superiority) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isLightboxOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6"
              onClick={() => setIsLightboxOpen(false)}
            >
              {/* Top Bar: Title & Close Button */}
              <div 
                className="w-full flex items-center justify-between text-white z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-wide">
                    {vehicle.year} {vehicle.makeName} {vehicle.modelName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">VIN: {vehicle.vin}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-slate-300">
                    {imgIndex + 1} of {allImages.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(false)}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer"
                    title="Close Fullscreen (Esc)"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Central Full-Size Image Container */}
              <div 
                className="relative flex-1 w-full flex items-center justify-center p-2 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.img
                  key={imgIndex}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  src={allImages[imgIndex]}
                  alt={`${vehicle.year} ${vehicle.makeName} full view`}
                  className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl select-none"
                />

                {/* Prev / Next Navigation Arrows */}
                {allImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIndex((imgIndex - 1 + allImages.length) % allImages.length);
                      }}
                      className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all shadow-xl hover:scale-105 cursor-pointer"
                      title="Previous Image"
                    >
                      <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIndex((imgIndex + 1) % allImages.length);
                      }}
                      className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all shadow-xl hover:scale-105 cursor-pointer"
                      title="Next Image"
                    >
                      <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
                    </button>
                  </>
                )}
              </div>

              {/* Bottom Thumbnail Strip */}
              {allImages.length > 1 && (
                <div 
                  className="w-full max-w-4xl flex items-center justify-center gap-2 overflow-x-auto py-2 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImgIndex(idx)}
                      className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        idx === imgIndex ? 'border-motorx-red scale-105 shadow-md' : 'border-white/20 opacity-50 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
