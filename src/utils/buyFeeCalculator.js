/**
 * Official Auction Buy Fee Schedule (ADESA / Standard Dealer Scale)
 * Matches the official tier structure shown in ADESA integration & reference modal.
 */
export const BUY_FEE_TIERS = [
    { min: 0, max: 299.99, fee: 100, label: "$0 - $299" },
    { min: 300, max: 499.99, fee: 150, label: "$300 - $499" },
    { min: 500, max: 799.99, fee: 185, label: "$500 - $799" },
    { min: 800, max: 999.99, fee: 200, label: "$800 - $999" },
    { min: 1000, max: 1999.99, fee: 275, label: "$1,000 - $1,999" },
    { min: 2000, max: 3999.99, fee: 300, label: "$2,000 - $3,999" },
    { min: 4000, max: 5999.99, fee: 350, label: "$4,000 - $5,999" },
    { min: 6000, max: 7999.99, fee: 400, label: "$6,000 - $7,999" },
    { min: 8000, max: 9999.99, fee: 425, label: "$8,000 - $9,999" },
    { min: 10000, max: 14999.99, fee: 450, label: "$10,000 - $14,999" },
    { min: 15000, max: 19999.99, fee: 500, label: "$15,000 - $19,999" },
    { min: 20000, max: 39999.99, fee: 550, label: "$20,000 - $39,999" },
    { min: 40000, max: Infinity, fee: 650, label: "$40,000+" }
];

/**
 * Calculates the exact auction buyer fee based on purchase / bid amount.
 * @param {number} amount - The vehicle bid or buy now price
 * @returns {number} The calculated fee in USD
 */
export function calculateBuyFee(amount) {
    const val = parseFloat(amount) || 0;
    if (val <= 0) return 0;

    const tier = BUY_FEE_TIERS.find(t => val >= t.min && val <= t.max);
    return tier ? tier.fee : 650;
}
