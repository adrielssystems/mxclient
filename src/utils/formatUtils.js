export const formatCurrency = (value) => {
    const num = parseFloat(value);
    const validNum = isNaN(num) ? 0 : num;
    return '$' + new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(validNum);
};
