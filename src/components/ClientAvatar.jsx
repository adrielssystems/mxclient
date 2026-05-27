import React from 'react';
import { Building } from 'lucide-react';

export default function ClientAvatar({ name, type, className = "", size = "md" }) {
    const sizeClasses = {
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
        xl: "h-16 w-16 text-xl"
    };

    const iconSizes = {
        sm: 14,
        md: 18,
        lg: 24,
        xl: 32
    };

    return (
        <div className={`${sizeClasses[size] || sizeClasses.md} flex-shrink-0 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold ${className}`}>
            {type === 'company' ? (
                <Building size={iconSizes[size] || 18} />
            ) : (
                (name || "?").charAt(0).toUpperCase()
            )}
        </div>
    );
}
