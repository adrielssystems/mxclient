export const formatCurrency = (value) => {
    return '$' + new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value || 0);
};
