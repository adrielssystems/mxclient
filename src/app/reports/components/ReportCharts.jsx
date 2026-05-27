import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const STATUS_LABELS = {
    purchased: "Purchased",
    at_warehouse: "At Warehouse",
    assignment_pending: "Pending Dispatch",
    dispatched: "Dispatched",
    in_transit: "In Transit",
    at_terminal: "At Terminal",
    booked: "Booked",
    loaded: "Loaded",
    in_transit_ocean: "In Transit (Ocean)",
    shipped: "Shipped",
    arrived: "Arrived",
    customs_cleared: "Customs Cleared",
    delivered: "Delivered",
    canceled: "Canceled"
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-sm border border-slate-700">
                <p className="font-bold mb-1">{label}</p>
                {payload.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                        <span className="text-slate-300">{entry.name}:</span>
                        <span className="font-bold">${Number(entry.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function ReportCharts({ statusDistribution, monthlySpending }) {
    // Format status distribution for PieChart
    const pieData = statusDistribution.map(s => ({
        name: STATUS_LABELS[s.status] || s.status?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Unknown",
        value: Number(s.count)
    }));

    // Format monthly spending for BarChart
    const barData = monthlySpending.map(m => ({
        name: new Date(m.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        total: Number(m.total)
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Spending Bar Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                    Monthly Spending (Last 12 Months)
                </h3>
                <div className="h-72">
                    {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Bar dataKey="total" name="Invoiced" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">No invoice data for this period.</div>
                    )}
                </div>
            </div>

            {/* Vehicle Status Pie  */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                    Vehicle Status Distribution
                </h3>
                <div className="h-72">
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={50}
                                    outerRadius={85}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: "11px" }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">No vehicles found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
