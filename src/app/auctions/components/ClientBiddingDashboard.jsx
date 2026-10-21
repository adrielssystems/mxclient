import React, { useState, useEffect } from 'react';
import { 
  Gavel, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  ArrowUpRight, 
  Star, 
  TrendingUp, 
  Eye, 
  RefreshCw,
  Search,
  Zap,
  Info,
  MapPin,
  Tag,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateBuyFee } from '@/utils/buyFeeCalculator';

export default function ClientBiddingDashboard({ onOpenVehicleModal }) {
  const [activeTab, setActiveTab] = useState('active'); // active, completed, wishlist
  const [activeBids, setActiveBids] = useState([]);
  const [completedBids, setCompletedBids] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all sections
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [activeRes, completedRes, wishRes] = await Promise.all([
        fetch('/api/auctions/bids?status=active'),
        fetch('/api/auctions/bids?status=completed'),
        fetch('/api/auctions/wishlist')
      ]);

      if (activeRes.ok) {
        const data = await activeRes.json();
        setActiveBids(data.bids || []);
      }
      if (completedRes.ok) {
        const data = await completedRes.json();
        setCompletedBids(data.bids || []);
      }
      if (wishRes.ok) {
        const data = await wishRes.json();
        setWishlist(data.wishlist || []);
      }
    } catch (e) {
      console.error("Error fetching bidding dashboard data:", e);
      toast.error("Failed to load bidding dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (val) => `$${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'WINNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> WINNING (MotorX Priority)
          </span>
        );
      case 'MX_OUTBID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" /> MX OUTBID
          </span>
        );
      case 'OUTBID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3.5 h-3.5" /> OUTBID
          </span>
        );
      case 'WON':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-black bg-emerald-600 text-white shadow-sm">
            WON
          </span>
        );
      case 'LOST':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-black bg-slate-200 text-slate-700">
            LOST
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Gavel className="w-6 h-6 text-motorx-red" /> Vehicle Bidding Dashboard
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-1">
            Track your active proxy bids, completed auction results, and saved vehicles in real time.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Tabs (Section 7 of PDF) */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'active' 
              ? 'border-motorx-red text-motorx-red' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Active Bids ({activeBids.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'completed' 
              ? 'border-motorx-red text-motorx-red' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Completed Bids ({completedBids.length})
        </button>
        <button
          onClick={() => setActiveTab('wishlist')}
          className={`pb-3 px-4 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'wishlist' 
              ? 'border-motorx-red text-motorx-red' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Star className="w-3.5 h-3.5 text-amber-500 fill-current" /> Watchlist ({wishlist.length})
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-wider">
          Loading Bids...
        </div>
      ) : (
        <>
          {/* 7.1 ACTIVE BIDS */}
          {activeTab === 'active' && (
            <div className="space-y-3">
              {activeBids.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                  <p className="text-slate-400 font-bold text-xs uppercase">No active proxy bids at this moment.</p>
                </div>
              ) : (
                activeBids.map((bid) => {
                  const details = bid.raw_vehicle_details || {};
                  return (
                    <div 
                      key={bid.id} 
                      className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        {details.primaryImageUrl ? (
                          <img src={details.primaryImageUrl} alt="Vehicle" className="w-20 h-14 object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="w-20 h-14 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 text-[10px]">No Photo</div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-500">{bid.vin}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">{bid.auction_source} • Lot #{bid.lot_number || 'N/A'}</span>
                          </div>
                          <h3 className="text-base font-black text-slate-900 mt-0.5">
                            {details.year} {details.make} {details.model}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium">Destination: {bid.destination_port || 'Standard Terminal'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">My Max Proxy Bid</span>
                          <span className="text-lg font-black text-slate-900">{formatCurrency(bid.max_proxy_bid)}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(bid.status)}
                          <span className="text-[10px] text-slate-400">Updated: {new Date(bid.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {onOpenVehicleModal && (
                          <button
                            onClick={() => onOpenVehicleModal(bid)}
                            className="px-3.5 py-2 bg-motorx-red hover:bg-motorx-red-dark text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow"
                          >
                            Increase Bid
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 7.2 COMPLETED BIDS */}
          {activeTab === 'completed' && (
            <div className="space-y-3">
              {completedBids.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
                  <p className="text-slate-400 font-bold text-xs uppercase">No completed bids in your history yet.</p>
                </div>
              ) : (
                completedBids.map((bid) => {
                  const details = bid.raw_vehicle_details || {};
                  const isWon = bid.status === 'WON';
                  return (
                    <div 
                      key={bid.id} 
                      className={`bg-white p-5 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isWon ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center gap-4">
                        {details.primaryImageUrl ? (
                          <img src={details.primaryImageUrl} alt="Vehicle" className="w-20 h-14 object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="w-20 h-14 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 text-[10px]">No Photo</div>
                        )}
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-500">{bid.vin}</span>
                          <h3 className="text-base font-black text-slate-900 mt-0.5">
                            {details.year} {details.make} {details.model}
                          </h3>
                          <p className="text-xs text-slate-400">Final Max Bid: {formatCurrency(bid.max_proxy_bid)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex flex-col items-start sm:items-end">
                          {getStatusBadge(bid.status)}
                          {isWon && (
                            <div className="mt-2 text-right bg-white p-2.5 rounded-lg border border-emerald-200 shadow-xs text-xs space-y-0.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Purchase Price</span>
                              <div className="text-slate-600 text-[11px] font-medium">
                                Purchase: <span className="font-bold text-slate-900">{formatCurrency(bid.max_proxy_bid)}</span>
                              </div>
                              <div className="text-slate-600 text-[11px] font-medium">
                                Auction Fees: <span className="font-bold text-slate-900">{formatCurrency(calculateBuyFee(bid.max_proxy_bid))}</span>
                              </div>
                              <div className="text-slate-600 text-[11px] font-medium">
                                Motor X Charges: <span className="font-bold text-slate-900">$850</span>
                              </div>
                              <div className="pt-1 border-t border-emerald-100 font-black text-emerald-700 text-xs">
                                Total: {formatCurrency(Number(bid.max_proxy_bid) + calculateBuyFee(bid.max_proxy_bid) + 850)}
                              </div>
                            </div>
                          )}
                          {bid.lost_reason && (
                            <span className="text-xs text-slate-500 italic max-w-xs text-right mt-1">
                              Reason: {bid.lost_reason.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 7.3 WATCHLIST */}
          {activeTab === 'wishlist' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {wishlist.length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200">
                  <Star className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-50" />
                  <p className="text-slate-400 font-bold text-xs uppercase">Your Watchlist is currently empty.</p>
                  <p className="text-slate-400 text-xs mt-1">Star vehicles from the auction catalog to track them here.</p>
                </div>
              ) : (
                wishlist.map((item) => {
                  let details = item.raw_details;
                  if (typeof details === 'string') {
                    try {
                      details = JSON.parse(details);
                    } catch (e) {
                      details = {};
                    }
                  }
                  details = details || {};

                  const year = details.year || '';
                  const make = details.makeName || details.make || '';
                  const model = details.modelName || details.model || '';
                  const series = details.seriesName || details.trim || '';
                  const title = `${year} ${make} ${model}`.trim() || item.vin;
                  const imageUrl = details.primaryImageUrl || details.imageUrl || (details.additionalImageUrls && details.additionalImageUrls[0]) || '/placeholder-car.png';
                  const currentBid = Number(details.currentHighBid || details.startingBid || item.max_proxy_bid || 0);
                  const buyNow = details.buyNowPrice ? Number(details.buyNowPrice) : null;
                  const vendor = details.auctionVendor || item.auction_source || 'ADESA';
                  const condition = details.condition || 'Clean Title';
                  const mileage = details.mileage || details.odometer;

                  return (
                    <div 
                      key={item.id} 
                      className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                    >
                      {/* Image & Badges */}
                      <div>
                        <div className="relative h-44 overflow-hidden bg-slate-900">
                          <img 
                            src={imageUrl} 
                            alt={title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                          
                          {/* Star Watchlist Badge */}
                          <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-md text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Watchlist
                          </span>

                          {/* Auction Vendor Badge */}
                          <span className="absolute top-3 right-3 px-2 py-0.5 bg-slate-900/80 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-wider">
                            {vendor}
                          </span>

                          {/* Quick Remove Button on Image */}
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await fetch(`/api/auctions/wishlist?vin=${encodeURIComponent(item.vin)}`, { method: 'DELETE' });
                              setWishlist(prev => prev.filter(w => w.id !== item.id));
                              toast.info("Removed from Watchlist");
                            }}
                            className="absolute bottom-3 right-3 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg transition-all backdrop-blur-sm shadow cursor-pointer opacity-90 hover:opacity-100"
                            title="Remove from Watchlist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Details Body */}
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-1">
                            <div className="truncate w-full">
                              <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">{item.vin}</span>
                              <h3 className="text-sm font-bold text-slate-900 truncate" title={title}>{title}</h3>
                              <p className="text-xs text-slate-500 truncate">
                                {series ? `${series} • ` : ''}
                                {mileage ? `${Number(mileage).toLocaleString()} mi` : 'Verified Mileage'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 mt-2 mb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{details.location || vendor}</span>
                          </div>

                          {/* Modalities & Condition */}
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {condition === 'Clean Title' ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                                <ShieldCheck className="w-2.5 h-2.5" /> Clean Title
                              </span>
                            ) : (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> {condition}
                              </span>
                            )}
                            <span className="bg-red-50 text-motorx-red border border-red-200 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" /> Live Auction
                            </span>
                          </div>

                          {/* Price Container */}
                          <div className="flex justify-between items-center mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="truncate">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Current Bid</p>
                              <p className="text-base font-black text-slate-900 truncate">{formatCurrency(currentBid)}</p>
                            </div>
                            {buyNow && (
                              <div className="text-right ml-2 truncate">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Buy Now</p>
                                <p className="text-sm font-bold text-slate-700 truncate">{formatCurrency(buyNow)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-4 pt-0 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenVehicleModal) {
                              onOpenVehicleModal({
                                vin: item.vin,
                                lot_number: item.lot_number,
                                lotNumber: item.lot_number,
                                auction_source: item.auction_source || vendor,
                                max_proxy_bid: currentBid,
                                raw_vehicle_details: {
                                  year: details.year,
                                  make: details.makeName || details.make,
                                  model: details.modelName || details.model,
                                  seriesName: details.seriesName || details.trim,
                                  primaryImageUrl: imageUrl,
                                  additionalImageUrls: details.additionalImageUrls || [],
                                  currentHighBid: currentBid,
                                  buyNowPrice: buyNow,
                                  odometer: mileage,
                                  mileage: mileage,
                                  condition: condition,
                                  auctionVendor: vendor
                                }
                              });
                            }
                          }}
                          className="w-full py-2.5 text-xs font-black uppercase tracking-wider bg-motorx-red hover:bg-motorx-red-dark text-white rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-center items-center gap-1 cursor-pointer"
                        >
                          Bid Now <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
