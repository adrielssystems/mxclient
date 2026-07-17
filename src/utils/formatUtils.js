export const formatCurrency = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0';
    
    // Ensure two decimal places, absolute value for parsing
    const fixed = Math.abs(num).toFixed(2);
    const parts = fixed.split('.');
    
    // Add commas for thousands separator
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    // Join with dot for decimal separator, ONLY if decimals are not '00'
    let formatted = '$' + parts[0];
    if (parts[1] !== "00") {
        formatted += '.' + parts[1];
    }
    
    return num < 0 ? '-' + formatted : formatted;
};
