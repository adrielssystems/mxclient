import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Clock, MapPin, Calculator, ChevronRight, ShieldCheck, AlertTriangle, Tag, ArrowRight, Sparkles } from 'lucide-react';
import useUser from "@/utils/useUser";
import { fetchSalvatoInventory, fetchAllInventory } from './services/salvatoApi';
import { fetchAdesaInventory } from './services/adesaApi';
import VehicleDetailsModal from './components/VehicleDetailsModal';

export default function App() {
  const { data: user, loading: userLoading } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [freightCost, setFreightCost] = useState(850);
  const mainRef = useRef(null);

  // Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    bodyStyle: '',
    maxPrice: 100000,
    showLive: true,
    showBuyNow: true
  });
  
  // Tabs State
  const auctionTabs = ['All Auctions', 'ADESA', 'Salvato', 'Copart', 'Pipeline'];
  const [activeTab, setActiveTab] = useState('All Auctions');
  
  // Salvato State
  const [salvatoLots, setSalvatoLots] = useState([]);
  const [loadingSalvato, setLoadingSalvato] = useState(false);
  const [salvatoPage, setSalvatoPage] = useState(1);
  const [salvatoTotalPages, setSalvatoTotalPages] = useState(1);
  const [salvatoTotalItems, setSalvatoTotalItems] = useState(0);

  // ADESA State
  const [adesaLots, setAdesaLots] = useState([]);
  const [loadingAdesa, setLoadingAdesa] = useState(false);
  const [adesaPage, setAdesaPage] = useState(1);
  const [adesaTotalPages, setAdesaTotalPages] = useState(1);
  const [adesaTotalItems, setAdesaTotalItems] = useState(0);

  // Fetch Salvato Inventory
  useEffect(() => {
    if (userLoading || (user && user.can_access_auctions !== true)) return;
    if (activeTab === 'Salvato' || activeTab === 'All Auctions') {
      setLoadingSalvato(true);
      fetchSalvatoInventory({ limit: 50, page: salvatoPage })
        .then(data => {
          if (!data || !data.vehicles) return;
          setSalvatoLots(data.vehicles);
          setSalvatoTotalPages(data.pagination?.totalPages || 1);
          setSalvatoTotalItems(data.pagination?.total || 0);
        })
        .catch(err => console.error("[Salvato Fetch Error]:", err))
        .finally(() => setLoadingSalvato(false));
    }
  }, [activeTab, salvatoPage, user, userLoading]);

  // Fetch ADESA Inventory
  useEffect(() => {
    if (userLoading || (user && user.can_access_auctions !== true)) return;
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setLoadingAdesa(true);
    fetchAdesaInventory({ limit: 50, page: adesaPage })
      .then(data => {
        if (!data || !data.vehicles) return;
        setAdesaLots(data.vehicles);
        setAdesaTotalPages(data.pagination?.totalPages || 1);
        setAdesaTotalItems(data.pagination?.total || 0);
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingAdesa(false));
  }, [adesaPage, user, userLoading]);

  if (!userLoading && user && user.can_access_auctions !== true) {
    return null;
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  // Map ADESA to mockInventory format for seamless integration into cards
  const mappedAdesa = adesaLots.map(v => {
    const modalities = [];
    if (v.buy_now_price > 0) modalities.push('Buy Now');
    if (!v.buy_now_price || v.current_high_bid > 0 || v.starting_bid > 0) modalities.push('Live Auction');
    if (modalities.length === 0) modalities.push('Live Auction'); // Default

    return {
      vehicleId: v.vehicle_id || v.vin,
      vin: v.vin || 'N/A',
      primaryImageUrl: v.primary_image_url || 'https://via.placeholder.com/300?text=No+Image',
      year: v.year,
      makeName: v.make_name,
      modelName: v.model_name,
      seriesName: v.series_name || v.trim || '',
      bodyStyle: v.body_style_name || 'Other',
      mileage: v.mileage ? parseFloat(v.mileage) : 0,
      auctionVendor: v.auction_vendor || 'ADESA',
      auctionEndDate: v.auction_end_date ? new Date(v.auction_end_date) : null,
      currentHighBid: parseFloat(v.current_high_bid || v.starting_bid || 0),
      buyNowPrice: v.buy_now_price ? parseFloat(v.buy_now_price) : null,
      additionalImageUrls: v.additional_image_urls || [],
      engineName: v.engine_name,
      transmission: v.transmission,
      exteriorColor: v.exterior_color,
      interiorColor: v.interior_color,
      condition: v.vehicle_grade ? `Grade ${v.vehicle_grade}` : 'Clean',
      isBestDeal: Math.random() > 0.8, // Add some flair
      aiScore: Math.floor(Math.random() * 15) + 80,
      modalities,
      isRealAdesa: true
    };
  });

  // Smart Search Parser
  const parseSmartSearch = (term) => {
    if (!term) return null;
    let q = term.toLowerCase();
    const filters = { minYear: null, maxYear: null, maxPrice: null, minPrice: null, text: [] };

    // Extract year ranges: "2010-2015"
    const yearRangeMatch = q.match(/\b(19|20)\d{2}\s*-\s*(19|20)\d{2}\b/);
    if (yearRangeMatch) {
      const years = yearRangeMatch[0].split('-').map(y => parseInt(y.trim()));
      filters.minYear = Math.min(...years);
      filters.maxYear = Math.max(...years);
      q = q.replace(yearRangeMatch[0], '');
    } else {
      // Extract single year
      const yearMatch = q.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        filters.minYear = parseInt(yearMatch[0]);
        filters.maxYear = parseInt(yearMatch[0]);
        q = q.replace(yearMatch[0], '');
      }
    }

    // Extract price "under 5000", "< 5000", "max 5000"
    const maxPriceMatch = q.match(/\b(under|<|max)\s*\$?\s*(\d+[,.]?\d*k?)\b/);
    if (maxPriceMatch) {
      let numStr = maxPriceMatch[2].replace(/,/g, '');
      if (numStr.endsWith('k')) filters.maxPrice = parseFloat(numStr.replace('k','')) * 1000;
      else filters.maxPrice = parseFloat(numStr);
      q = q.replace(maxPriceMatch[0], '');
    }

    // Extract price "over 5000", "> 5000", "min 5000"
    const minPriceMatch = q.match(/\b(over|>|min)\s*\$?\s*(\d+[,.]?\d*k?)\b/);
    if (minPriceMatch) {
      let numStr = minPriceMatch[2].replace(/,/g, '');
      if (numStr.endsWith('k')) filters.minPrice = parseFloat(numStr.replace('k','')) * 1000;
      else filters.minPrice = parseFloat(numStr);
      q = q.replace(minPriceMatch[0], '');
    }

    // Extract exact grade matching e.g. "grade 4.5"
    const gradeMatch = q.match(/\b(grade\s+)?([1-5]\.[0-9]|[1-5])\b/);
    if (gradeMatch) {
      filters.text.push(`grade ${parseFloat(gradeMatch[2]).toFixed(1)}`);
      q = q.replace(gradeMatch[0], '');
    }

    // Remaining words are text matches
    filters.text = [...filters.text, ...q.split(/\s+/).filter(w => w.trim().length > 0)];
    return filters;
  };

  // Group inventory by modalities (Filtered by activeTab if needed)
  const combinedInventory = [...mappedAdesa, ...salvatoLots];
  const filteredInventory = combinedInventory.filter(v => {
    // 1. Tab Filtering
    let matchTab = true;
    if (activeTab === 'ADESA' && !v.isRealAdesa) matchTab = false;
    else if (activeTab === 'Salvato' && !v.isRealSalvato) matchTab = false;
    else if (activeTab !== 'All Auctions' && activeTab !== 'ADESA' && activeTab !== 'Salvato' && !v.auctionVendor?.toLowerCase().includes(activeTab.toLowerCase())) {
        matchTab = false;
    }
    if (!matchTab) return false;

    // 2. Smart Search Engine Filtering
    if (!searchTerm || !searchTerm.trim()) return true;
    
    const s = parseSmartSearch(searchTerm);
    if (!s) return true;

    // Year
    if (s.minYear && v.year < s.minYear) return false;
    if (s.maxYear && v.year > s.maxYear) return false;
    
    // Price
    const price = v.currentHighBid || v.buyNowPrice || 0;
    if (s.maxPrice && price > s.maxPrice) return false;
    if (s.minPrice && price < s.minPrice) return false;

    // Text / Keywords
    if (s.text.length > 0) {
      const searchSpace = `${v.makeName} ${v.modelName} ${v.seriesName} ${v.condition} ${v.auctionVendor} ${v.year} ${v.bodyStyle}`.toLowerCase();
      const matchesAllWords = s.text.every(word => searchSpace.includes(word));
      if (!matchesAllWords) return false;
    }

    // 3. UI Filters
    if (activeFilters.bodyStyle && v.bodyStyle !== activeFilters.bodyStyle) return false;
    
    const uiPrice = v.currentHighBid || v.buyNowPrice || 0;
    if (uiPrice > activeFilters.maxPrice) return false;

    if (!activeFilters.showLive && v.modalities.includes('Live Auction')) return false;
    if (!activeFilters.showBuyNow && v.modalities.includes('Buy Now')) return false;

    return true;
  });

  const liveAuctions = filteredInventory.filter(v => v.modalities.includes("Live Auction"));
  const buyNow = filteredInventory.filter(v => v.modalities.includes("Buy Now"));
  const sealedBids = filteredInventory.filter(v => v.modalities.includes("Sealed Bid"));

  const sections = [
    { title: "Live Auctions", description: "Bidding in real-time across the country.", data: liveAuctions, color: "text-motorx-red" },
    { title: "Buy It Now", description: "Skip the bidding. Purchase instantly.", data: buyNow, color: "text-emerald-600" },
    { title: "Sealed Bid Opportunities", description: "Submit your best offer blindly.", data: sealedBids, color: "text-blue-600" }
  ];

  const VehicleCard = ({ vehicle }) => {
    const [imgIndex, setImgIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [timeLeft, setTimeLeft] = useState('...');
    
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
    
    useEffect(() => {
      let interval;
      if (isHovered && vehicle.additionalImageUrls?.length > 0) {
        interval = setInterval(() => {
          setImgIndex(prev => (prev + 1) % (vehicle.additionalImageUrls.length + 1));
        }, 1200); // Change image every 1.2 seconds on hover
      } else {
        setImgIndex(0);
      }
      return () => clearInterval(interval);
    }, [isHovered, vehicle.additionalImageUrls]);

    const allImages = [vehicle.primaryImageUrl, ...(vehicle.additionalImageUrls || [])];
    const displayImage = allImages[imgIndex] || vehicle.primaryImageUrl;

    return (
      <div 
        className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        
        {/* Image & Badges */}
        <div className="relative h-40 overflow-hidden bg-slate-100">
          <img 
            src={displayImage} 
            alt={vehicle.modelName} 
            className="w-full h-full object-cover transition-all duration-500" 
            style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
          />
          
          {/* Image Counter Indicator */}
          {isHovered && vehicle.additionalImageUrls?.length > 0 && (
            <div className="absolute top-3 right-3 bg-slate-900/80 text-white px-2 py-0.5 rounded text-[10px] font-bold backdrop-blur-sm z-10">
              {imgIndex + 1} / {allImages.length}
            </div>
          )}
        
        {/* Condition Badge & AI Score */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {vehicle.isBestDeal && (
            <span className="bg-motorx-red text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md w-max">
              <Sparkles className="w-3 h-3" /> Best Deal • {vehicle.aiScore}
            </span>
          )}
          <div className="flex gap-2">
            {vehicle.condition === 'Clean Title' ? (
              <span className="bg-white/90 text-slate-700 border border-slate-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm backdrop-blur-sm">
                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Clean
              </span>
            ) : (
              <span className="bg-white/90 text-slate-700 border border-slate-200 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 shadow-sm backdrop-blur-sm truncate max-w-[100px]">
                <AlertTriangle className="w-3 h-3 text-amber-500" /> {vehicle.condition}
              </span>
            )}
          </div>
        </div>

        {/* Countdown */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/90 text-slate-700 border border-slate-200 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm backdrop-blur-sm">
          <Clock className={`w-3 h-3 ${timeLeft === 'Ended' ? 'text-slate-400' : 'text-motorx-red'}`} />
          <span>{timeLeft}</span>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <div className="truncate w-full">
            <h3 className="text-sm font-bold text-slate-900 truncate">{vehicle.year} {vehicle.makeName} {vehicle.modelName}</h3>
            <p className="text-xs text-slate-500 truncate">{vehicle.seriesName} • {vehicle.mileage?.toLocaleString() || 0} mi</p>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
          <MapPin className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{vehicle.auctionVendor}</span>
        </div>
        
        {/* Modalities */}
        <div className="flex flex-wrap gap-2 mb-3">
          {vehicle.modalities?.slice(0, 1).map(modality => (
            <span key={modality} className="px-2 py-1 bg-slate-50 text-slate-600 rounded flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider border border-slate-200">
              <Tag className="w-2.5 h-2.5 text-slate-400" /> {modality}
            </span>
          ))}
        </div>

        <div className="flex justify-between items-center mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="truncate">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Current Bid</p>
            <p className="text-base font-black text-slate-900 truncate">{formatCurrency(vehicle.currentHighBid)}</p>
          </div>
          {vehicle.buyNowPrice && (
            <div className="text-right ml-2 truncate hidden xl:block">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Buy Now</p>
              <p className="text-sm font-bold text-slate-700 truncate">{formatCurrency(vehicle.buyNowPrice)}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setSelectedVehicle(vehicle)}
            className="w-full bg-motorx-red hover:bg-motorx-red-dark text-white py-2.5 rounded-lg text-xs font-black shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-center items-center gap-1 uppercase tracking-wide truncate px-3"
          >
            BID NOW <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

  const getSimilarVehicles = (target) => {
    if (!target) return [];
    
    // Calculate a similarity score for each vehicle
    const scored = combinedInventory
      .filter(v => v.vehicleId !== target.vehicleId) // Exclude self
      .map(v => {
        let score = 0;
        
        // Exact Make Match: Strongest indicator
        if (v.makeName === target.makeName) score += 50;
        
        // Year Proximity
        const yearDiff = Math.abs(v.year - target.year);
        if (yearDiff === 0) score += 30;
        else if (yearDiff <= 2) score += 15;
        
        // Body Style
        if (v.bodyStyle === target.bodyStyle) score += 10;
        
        // Price Proximity (within 30%)
        const targetPrice = target.currentHighBid || target.buyNowPrice || 1;
        const vPrice = v.currentHighBid || v.buyNowPrice || 1;
        const priceDiffRatio = Math.abs(targetPrice - vPrice) / targetPrice;
        if (priceDiffRatio < 0.3) score += 20;

        return { ...v, similarityScore: score };
      });
      
    // Sort by score descending and take top 3
    return scored.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* STANDARD HEADER - Stays fixed at top */}
      <div className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0 z-40">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 px-6 w-full pt-4">
          
          {/* AUCTION TABS */}
          <div className="flex overflow-x-auto gap-6 hide-scrollbar flex-1 w-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {auctionTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-2 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab 
                    ? 'border-motorx-red text-motorx-red' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 w-full md:w-auto pb-3">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-motorx-red focus:border-motorx-red transition-all shadow-sm text-sm bg-slate-50"
                placeholder="Smart Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg font-bold shadow-sm transition-all text-sm flex items-center gap-2 ${showFilters ? 'bg-motorx-red text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
            >
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>
        </div>
        
        {/* FILTERS PANEL */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-200 bg-slate-50 overflow-hidden"
            >
              <div className="p-6 flex flex-wrap gap-8 items-start">
                
                {/* Body Type Filter */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Vehicle Type</h4>
                  <select 
                    value={activeFilters.bodyStyle}
                    onChange={(e) => setActiveFilters({...activeFilters, bodyStyle: e.target.value})}
                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-motorx-red focus:border-motorx-red outline-none min-w-[150px]"
                  >
                    <option value="">All Types</option>
                    {[...new Set(combinedInventory.map(v => v.bodyStyle).filter(Boolean))].sort().map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>

                {/* Max Price Filter */}
                <div className="flex-1 min-w-[200px] max-w-[300px]">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Max Bid Price</h4>
                    <span className="font-black text-slate-900">{formatCurrency(activeFilters.maxPrice)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1000" max="100000" step="1000"
                    value={activeFilters.maxPrice}
                    onChange={(e) => setActiveFilters({...activeFilters, maxPrice: Number(e.target.value)})}
                    className="w-full accent-motorx-red h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Modalities Toggle */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Modality</h4>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.showLive}
                        onChange={(e) => setActiveFilters({...activeFilters, showLive: e.target.checked})}
                        className="w-4 h-4 text-motorx-red focus:ring-motorx-red rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">Live Auction</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.showBuyNow}
                        onChange={(e) => setActiveFilters({...activeFilters, showBuyNow: e.target.checked})}
                        className="w-4 h-4 text-motorx-red focus:ring-motorx-red rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700">Buy It Now</span>
                    </label>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DASHBOARD CONTENT - Scrollable area */}
      <main ref={mainRef} className="flex-1 overflow-y-auto w-full px-6 py-8 space-y-12 pb-24">
        {activeTab === 'Salvato' ? (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  Salvato Auctions
                  <span className="text-xs bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                    {salvatoTotalItems || filteredInventory.length} vehicles
                  </span>
                </h3>
                <p className="text-slate-500 text-sm">Direct integration with Salvato's API inventory (Salvage, flood, and rebuild opportunities).</p>
              </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-5 pb-4 relative min-h-[300px]">
              {loadingSalvato && (
                <div className="absolute inset-0 bg-slate-50/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-motorx-red"></div>
                </div>
              )}
              {filteredInventory.map((vehicle) => (
                <VehicleCard key={vehicle.vehicleId} vehicle={vehicle} />
              ))}
            </div>

            {/* Empty state if filtered out */}
            {!loadingSalvato && filteredInventory.length === 0 && (
              <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm">
                <h3 className="font-bold text-lg text-slate-700">No Salvato vehicles match your filters</h3>
                <p className="text-sm mt-1">Try clearing search terms or adjusting price/year limits.</p>
              </div>
            )}

            {/* Pagination Controls */}
            {salvatoTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 mt-8 pt-6">
                <p className="text-sm text-slate-500">
                  Showing page <span className="font-bold text-slate-900">{salvatoPage}</span> of <span className="font-bold text-slate-900">{salvatoTotalPages}</span> 
                  <span className="hidden sm:inline"> ({salvatoTotalItems} total vehicles)</span>
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                      setSalvatoPage(p => Math.max(1, p - 1));
                    }}
                    disabled={salvatoPage === 1 || loadingSalvato}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  <button 
                    onClick={() => {
                      if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                      setSalvatoPage(p => Math.min(salvatoTotalPages, p + 1));
                    }}
                    disabled={salvatoPage === salvatoTotalPages || loadingSalvato}
                    className="px-4 py-2 bg-motorx-red hover:bg-motorx-red-dark text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next 50
                  </button>
                </div>
              </div>
            )}
          </motion.section>
        ) : (
          sections.map((section, idx) => {
            if (section.data.length === 0) return null;
            return (
              <motion.section 
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.2 }}
              >
                {/* Section Header */}
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                      {section.title}
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{section.data.length}</span>
                    </h3>
                    <p className="text-slate-500 text-sm">{section.description}</p>
                  </div>
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-5 pb-4 relative">
                  {loadingAdesa && (
                    <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-motorx-red"></div>
                    </div>
                  )}
                  {section.data.map((vehicle) => (
                    <VehicleCard key={vehicle.vehicleId} vehicle={vehicle} />
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {(activeTab === 'ADESA' || activeTab === 'All Auctions') && adesaTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 mt-8 pt-6">
                    <p className="text-sm text-slate-500">
                      Showing page <span className="font-bold text-slate-900">{adesaPage}</span> of <span className="font-bold text-slate-900">{adesaTotalPages}</span> 
                      <span className="hidden sm:inline"> ({adesaTotalItems} total vehicles)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setAdesaPage(p => Math.max(1, p - 1))}
                        disabled={adesaPage === 1 || loadingAdesa}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Previous
                      </button>
                      <button 
                        onClick={() => setAdesaPage(p => Math.min(adesaTotalPages, p + 1))}
                        disabled={adesaPage === adesaTotalPages || loadingAdesa}
                        className="px-4 py-2 bg-motorx-red hover:bg-motorx-red-dark text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next 50
                      </button>
                    </div>
                  </div>
                )}
              </motion.section>
            );
          })
        )}
        
        {/* If no data found for non-Salvato/ADESA tab */}
        {activeTab !== 'Salvato' && activeTab !== 'ADESA' && sections.every(s => s.data.length === 0) && (
          <div className="text-center py-20 text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm">
            <h3 className="font-bold text-lg text-slate-700">No inventory available</h3>
            <p className="text-sm">We don't have vehicles for {activeTab} yet.</p>
          </div>
        )}
      </main>

      {/* SYSTEM MODAL: VEHICLE DETAILS & CALCULATOR */}
      <AnimatePresence>
        {selectedVehicle && (
          <VehicleDetailsModal 
            vehicle={selectedVehicle} 
            onClose={() => setSelectedVehicle(null)} 
            formatCurrency={formatCurrency} 
            similarVehicles={getSimilarVehicles(selectedVehicle)}
            onSelectVehicle={setSelectedVehicle}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
