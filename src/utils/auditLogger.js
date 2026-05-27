import sql from '@/app/api/utils/sql';

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {number} params.userId - ID of the user performing the action
 * @param {string} params.userName - Name of the user
 * @param {string} params.userEmail - Email of the user
 * @param {string} params.userRole - Role of the user (admin, employee, client, etc.)
 * @param {string} params.action - Action performed (e.g., 'VEHICLE_CREATE', 'LOGIN_SUCCESS')
 * @param {string} params.resourceType - Type of resource affected (e.g., 'vehicle', 'user')
 * @param {string} params.resourceId - ID of the resource (e.g., VIN, user ID)
 * @param {Object} params.details - Additional details about the action (JSON)
 * @param {string} params.ipAddress - IP address of the user
 * @param {string} params.userAgent - User agent string
 * @param {string} params.status - Status of the action ('success' or 'failed')
 */
export async function logAudit({
    userId,
    userName,
    userEmail,
    userRole,
    action,
    resourceType = null,
    resourceId = null,
    details = null,
    ipAddress = null,
    userAgent = null,
    status = 'success'
}) {
    try {
        // Handle userId safely - if it's a string (like UUID) don't parseInt it to NaN
        let safeUserId = userId;
        if (typeof userId === 'string' && /^\d+$/.test(userId)) {
            safeUserId = parseInt(userId);
        } else if (typeof userId === 'number' && isNaN(userId)) {
            safeUserId = null;
        }

        const safeDetails = details ? JSON.stringify(details) : null;

        console.log(`[Audit] ATTEMPTING to log action: ${action}`);
        console.log(`[Audit] Data: user=${userEmail}, role=${userRole}, userId=${safeUserId}, resource=${resourceType}/${resourceId}`);

        const result = await sql`
      INSERT INTO audit_logs (
        user_id, 
        user_name, 
        user_email,
        user_role,
        action, 
        resource_type, 
        resource_id, 
        details, 
        ip_address, 
        user_agent, 
        status
      )
      VALUES (
        ${safeUserId ? safeUserId.toString() : null}, 
        ${userName || null}, 
        ${userEmail || null},
        ${userRole || null},
        ${action || 'UNKNOWN_ACTION'}, 
        ${resourceType || null}, 
        ${resourceId || null}, 
        ${safeDetails || null}, 
        ${ipAddress || null}, 
        ${userAgent || null}, 
        ${status || 'success'}
      )
      RETURNING id
    `;
        console.log(`[Audit] SUCCESS! Created log ID: ${result[0]?.id}`);
    } catch (error) {
        console.error('[Audit] CRITICAL ERROR inserting into audit_logs:', error);
        console.error('[Audit] Error Details:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint
        });
    }
}

/**
 * Get user info from request headers
 * @param {Request} request - The request object
 * @returns {Object} Object with ipAddress and userAgent
 */
export function getRequestInfo(request) {
    const ipAddress = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    return { ipAddress, userAgent };
}

/**
 * Audit action types constants
 */
export const AUDIT_ACTIONS = {
    // Authentication
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGOUT: 'LOGOUT',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE',

    // Vehicles
    VEHICLE_CREATE: 'VEHICLE_CREATE',
    VEHICLE_UPDATE: 'VEHICLE_UPDATE',
    VEHICLE_DELETE: 'VEHICLE_DELETE',
    VEHICLE_VIEW: 'VEHICLE_VIEW',
    VEHICLE_IMPORT: 'VEHICLE_IMPORT',
    VEHICLE_EXPORT: 'VEHICLE_EXPORT',

    // Users
    USER_CREATE: 'USER_CREATE',
    USER_UPDATE: 'USER_UPDATE',
    USER_DELETE: 'USER_DELETE',

    // Admin
    BACKUP_CREATE: 'BACKUP_CREATE',
    BACKUP_RESTORE: 'BACKUP_RESTORE',
    REPORT_SEND: 'REPORT_SEND',

    // Locations
    LOCATION_CREATE: 'LOCATION_CREATE',
    LOCATION_UPDATE: 'LOCATION_UPDATE',
    LOCATION_DELETE: 'LOCATION_DELETE',

    // Client Rules
    CLIENT_RULE_CREATE: 'CLIENT_RULE_CREATE',
    CLIENT_RULE_UPDATE: 'CLIENT_RULE_UPDATE',
    CLIENT_RULE_DELETE: 'CLIENT_RULE_DELETE',

    // Invoices & Payments
    INVOICE_CREATE: 'INVOICE_CREATE',
    INVOICE_CREATE_LOCAL: 'INVOICE_CREATE_LOCAL',
    INVOICE_UPDATE: 'INVOICE_UPDATE',
    INVOICE_DELETE: 'INVOICE_DELETE',
    PAYMENT_RECORD: 'PAYMENT_RECORD',
    PAYMENT_SYNC: 'PAYMENT_SYNC',

    // Google Drive
    DRIVE_SYNC_ALL: 'DRIVE_SYNC_ALL',
    DRIVE_UPLOAD: 'DRIVE_UPLOAD',
    DRIVE_FOLDER_CREATE: 'DRIVE_FOLDER_CREATE',

    // System Jobs
    JOB_LATE_FEES: 'JOB_LATE_FEES',
    SYSTEM_SYNC: 'SYSTEM_SYNC',
};

/**
 * Resource type constants
 */
export const RESOURCE_TYPES = {
    VEHICLE: 'vehicle',
    USER: 'user',
    CLIENT: 'client',
    BACKUP: 'backup',
    REPORT: 'report',
    SYSTEM: 'system',
    LOCATION: 'location',
    INVOICE: 'invoice',
};
