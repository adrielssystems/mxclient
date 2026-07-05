import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DollarSign, FileText, Truck, CheckCircle2, Car } from 'lucide-react';
import { format, subMonths, isAfter, startOfMonth } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function ClientReportsDashboard({ vehicles = [] }) {
    // 1. Calculate Metrics
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

    // 2. Prepare 12-Month Bar Chart Data
    const monthlyData = useMemo(() => {
        const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11));
        const monthMap = {};
        
        // Initialize last 12 months
        for (let i = 11; i >= 0; i--) {
            const d = subMonths(new Date(), i);
            monthMap[format(d, 'MMM yyyy')] = 0;
        }

        vehicles.forEach(v => {
            if (v.purchase_date) {
                const pDate = new Date(v.purchase_date);
                if (isAfter(pDate, twelveMonthsAgo)) {
                    const monthKey = format(pDate, 'MMM yyyy');
                    if (monthMap[monthKey] !== undefined) {
                        monthMap[monthKey]++;
                    }
                }
            }
        });

        return Object.keys(monthMap).map(key => ({
            name: key,
            Purchases: monthMap[key]
        }));
    }, [vehicles]);

    // 3. Prepare Auction Donut Chart Data
    const auctionData = useMemo(() => {
        const auctionCount = {};
        vehicles.forEach(v => {
            const name = v.auction_name || 'Other';
            auctionCount[name] = (auctionCount[name] || 0) + 1;
        });

        return Object.keys(auctionCount).map(key => ({
            name: key,
            value: auctionCount[key]
        })).sort((a, b) => b.value - a.value); // Sort descending
    }, [vehicles]);

    return (
        <div className="space-y-6">
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

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar Chart */}
                <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-6">Purchases - Last 12 Months</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                                <RechartsTooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ fontWeight: 800, color: '#334155', marginBottom: '4px' }}
                                    itemStyle={{ fontWeight: 600 }}
                                />
                                <Bar dataKey="Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut Chart */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-6">Purchases by Auction</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={auctionData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={70}
                                    outerRadius={95}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {auctionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontWeight: 600, color: '#334155' }}
                                />
                                <Legend 
                                    verticalAlign="bottom" 
                                    height={36} 
                                    iconType="circle"
                                    formatter={(value) => <span className="text-[11px] font-bold text-slate-600">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
