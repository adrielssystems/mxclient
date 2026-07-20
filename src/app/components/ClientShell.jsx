"use client";
import React, { useState, useEffect } from 'react';
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import { LogOut, Home, Car, CreditCard, FileText, ArrowLeft, Eye, AlertTriangle } from "lucide-react";

const CLIENT_TABS = [
    { id: "overview", path: "/", name: "Overview", icon: Home },
    { id: "vehicles", path: "/vehicles", name: "My Vehicles", icon: Car },
    { id: "payments", path: "/payments", name: "Payments", icon: CreditCard },
    { id: "reports", path: "/reports", name: "Reports", icon: FileText },
];

export default function ClientShell({ children }) {
    const { data: user, loading } = useUser();
    const { signOut } = useAuth();

    const [currentPath, setCurrentPath] = useState('');
    const [impersonating, setImpersonating] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            setCurrentPath(path);

            // --- INACTIVITY RESET (30 MINS) ---
            const lastActivity = localStorage.getItem('clientLastActivity');
            const now = Date.now();
            const thirtyMins = 30 * 60 * 1000;

            if (lastActivity && (now - parseInt(lastActivity)) > thirtyMins) {
                // If expired and not already at overview, redirect
                if (path !== '/' && !path.startsWith('/?')) {
                    window.location.href = '/';
                    return; // Stop further execution
                }
            }
            // Update activity timestamp on every navigation/check
            localStorage.setItem('clientLastActivity', now.toString());

            // Check for impersonation cookie
            try {
                const cookies = document.cookie.split(';').map(c => c.trim());
                const imp = cookies.find(c => c.startsWith('motorx-impersonate='));
                if (imp) {
                    const val = decodeURIComponent(imp.split('=').slice(1).join('='));
                    const parsed = JSON.parse(val);
                    setImpersonating(parsed.payload || parsed);
                }
            } catch (e) {
                console.error('Failed to parse impersonation cookie:', e);
            }
        }
    }, [typeof window !== 'undefined' ? window.location.pathname : null]);

    const exitImpersonation = async () => {
        await fetch('/api/admin/impersonate', { method: 'DELETE' });
        
        const hostname = window.location.hostname;
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
            window.location.href = 'http://localhost:4000/admin?page=clients';
        } else {
            window.location.href = 'https://dev.motorxcars.com/admin?page=clients';
        }
    };



    if (loading && !user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mx-auto"></div>
            </div>
        );
    }

    if (!user) {
        // Unauthenticated access handled locally or by middleware, simple fallback here
        if (typeof window !== 'undefined') {
            window.location.href = '/account/signin';
        }
        return null;
    }

    // Role Enforcement (Crucial B2B Isolation)
    const userRole = (user.role || '').toLowerCase();
    const isAllowedRole = ['client', 'main_client', 'sub_client'].includes(userRole);
    
    // Admins/employees are only allowed if they are impersonating a client or explicitly allowed
    if (!isAllowedRole && !impersonating) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden font-sans">
                {/* Background glows */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600 opacity-10 rounded-full blur-[120px] pointer-events-none"></div>
                
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 text-white">
                    <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    
                    <h1 className="text-xl font-bold tracking-tight text-white mb-8">
                        This portal is exclusively for client accounts
                    </h1>
                    
                    <button
                        onClick={() => signOut()}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:scale-[1.02] active:scale-[0.98] text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-[0_4px_20px_rgba(220,38,38,0.25)] flex items-center justify-center gap-2"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    const NavBtn = ({ tab }) => {
        const isActive = currentPath === tab.path || (tab.path !== '/' && currentPath.startsWith(tab.path));
        return (
            <a
                href={tab.path}
                className={`${isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    } group flex w-full items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200`}
            >
                <tab.icon className={`${isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"} mr-3 h-5 w-5 flex-shrink-0 transition-colors`} />
                <span className="truncate tracking-wide">{tab.name}</span>
            </a>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Impersonation Banner */}
            {impersonating && (
                <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between z-50 relative shadow-lg">
                    <div className="flex items-center gap-2">
                        <Eye size={18} className="animate-pulse" />
                        <span className="text-sm font-bold">
                            Viewing as: {impersonating.clientName} ({impersonating.clientEmail})
                        </span>
                    </div>
                    <button
                        onClick={exitImpersonation}
                        className="flex items-center gap-1.5 bg-white text-amber-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-50 transition-colors shadow-sm"
                    >
                        <ArrowLeft size={14} />
                        Return to Admin
                    </button>
                </div>
            )}
            {/* Header */}
            <header className="bg-slate-900/90 backdrop-blur-md shadow-sm border-b border-slate-800 z-20 relative flex-shrink-0">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <a href="/" className="flex items-center">
                                <img src="/images/logo-new.png" alt="MotorX" className="h-8 w-auto object-contain mr-3" />
                                <h1 className="text-xl font-bold text-white tracking-tight hidden sm:block">Client Portal</h1>
                            </a>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4">
                            <span className="text-sm font-medium text-white hidden sm:block truncate max-w-[200px]" title={user.name || user.email}>
                                {user.name || user.email}
                            </span>
                            {user.role === 'admin' && (
                                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-red-900/50 text-red-200 text-xs font-semibold rounded-full border border-red-700">
                                    Masquerading Admin
                                </span>
                            )}
                            <button
                                onClick={() => window.location.href = '/account/logout'}
                                className="flex items-center text-slate-400 hover:text-red-400 transition-colors sm:ml-4 text-sm font-medium"
                            >
                                <LogOut className="h-4 w-4 mr-1.5" />
                                <span className="hidden sm:inline-block">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden h-[calc(100vh-64px)]">
                {/* Sidebar Desktop */}
                <aside className="w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col shrink-0 overflow-hidden">
                    <nav className="p-4 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                        {CLIENT_TABS.map(tab => (
                            <NavBtn key={tab.id} tab={tab} />
                        ))}
                    </nav>

                    {/* Subtle Developer Signature */}
                    <div className="p-4 border-t border-slate-800/50 bg-slate-900/50 mt-auto">
                        <p className="text-[9px] text-slate-600 font-medium tracking-tight text-center leading-tight">
                            Developed by <a href="https://adrielssystems.com" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400 transition-colors">Adriel's Systems</a>
                            <br />
                            <span className="opacity-40 font-light">The Engine of Your Software</span>
                        </p>
                    </div>
                </aside>

                {/* Mobile Navigation Row */}
                <div className="md:hidden bg-slate-900 border-b border-slate-800 flex-shrink-0 overflow-x-auto no-scrollbar">
                    <nav className="flex px-4 py-2 gap-2 w-max">
                        {CLIENT_TABS.map(tab => {
                            const isActive = currentPath === tab.path || (tab.path !== '/' && currentPath.startsWith(tab.path));
                            return (
                                <a
                                    key={tab.id}
                                    href={tab.path}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${isActive
                                        ? "bg-blue-600 text-white shadow-sm"
                                        : "text-slate-400 hover:text-white bg-slate-800"
                                        }`}
                                >
                                    <tab.icon size={14} />
                                    <span>{tab.name}</span>
                                </a>
                            );
                        })}
                    </nav>
                </div>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30 relative p-4 sm:p-6 lg:p-8 xl:p-10">
                    <div className="w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
