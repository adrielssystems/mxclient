/**
 * Utility to manage vehicle status colors and formatting
 */

export const VEHICLE_STATUSES = {
    ENTERED: 'entered',
    PURCHASED: 'purchased',
    IN_TRANSIT: 'in_transit',
    COMPLETED: 'completed',
    TITLE_SERVICES: 'title_services',
    DISMANTLING: 'dismantling',
    REINSTATED: 'reinstated',
    DISPATCHED: 'dispatched',
    AT_TERMINAL: 'at_terminal',
    BOOKED_LOADED: 'booked_loaded',
    DELIVERED: 'delivered'
};

/**
 * Get CSS classes for status badges based on status type
 * @param {string} status - The vehicle status
 * @returns {string} Tailwind CSS classes
 */
export function getStatusColor(status) {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';

    const s = status.toLowerCase();

    switch (s) {
        case 'purchased':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'in_transit':
        case 'shipped':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'completed':
        case 'delivered':
        case 'arrived':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'title_services':
            return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'dismantling':
            return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'reinstated':
            return 'bg-red-100 text-red-800 border-red-200 font-bold';
        case 'dispatched':
            return 'bg-cyan-100 text-cyan-800 border-cyan-200';
        case 'at_terminal':
        case 'at_warehouse':
            return 'bg-indigo-100 text-indigo-800 border-indigo-200';
        case 'booked_loaded':
        case 'booked':
            return 'bg-teal-100 text-teal-800 border-teal-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
}

/**
 * Format status string for display
 * @param {string} status 
 * @returns {string}
 */
export function formatStatus(status) {
    if (!status) return '-';
    if (status === 'entered') return 'New';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
