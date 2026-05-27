export const formatToMDY = (date) => {
    if (!date) return "";

    // Fix for strings containing 'T' (e.g. 2026-04-16T00:00:00.000Z) being parsed as UTC, 
    // causing off-by-one day in Western timezones.
    let dateString = date;
    if (typeof dateString === 'string' && dateString.includes('T')) {
        dateString = dateString.split('T')[0];
    }

    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const [y, m, d] = dateString.split('-').map(Number);
        return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();

    return `${month}/${day}/${year}`;
};

export const parseMDY = (dateString) => {
    if (!dateString || typeof dateString !== "string") return null;

    const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null; // Reject unrecognized formats — do NOT fall back to new Date() (timezone-unsafe)

    const month = parseInt(match[1], 10) - 1;
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
};

export const formatToISO = (date) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    // Use local date parts to avoid UTC drift (toISOString() returns UTC midnight)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const formatDateInput = (value, previousValue = "") => {
    // Remove all non-numeric characters
    let clean = value.replace(/\D/g, "");
    
    // Check if we are deleting (length decreased and was a slash)
    const isDeleting = previousValue && value.length < previousValue.length;

    // Capture digits
    const mm = clean.substring(0, 2);
    const dd = clean.substring(2, 4);
    const yyyy = clean.substring(4, 8);

    if (clean.length > 4) {
        return `${mm}/${dd}/${yyyy}`;
    } else if (clean.length > 2) {
        return `${mm}/${dd}`;
    }
    return mm;
};
