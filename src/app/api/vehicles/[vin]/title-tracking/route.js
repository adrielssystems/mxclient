import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

function computeDerivedStatus(row) {
    if (!row) return "Not Received";

    // Automatic always beats manual (spec: Manual Status < Automatic Status)
    if (row.date_mailed)    return "Sent";      // highest automatic priority
    if (row.date_received)  return "Received";  // second automatic priority

    // Manual override — only applies when no automatic date exists
    if (row.manual_status)  return row.manual_status;

    return "Not Received";
}


export async function GET(request, { params }) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { vin } = params;

        // 1. Resolve ACTIVE vehicle_id first
        const vResult = await sql`
            SELECT id, client_id FROM vehicles 
            WHERE vin = ${vin} AND master_status != 'cancelled'
            LIMIT 1
        `;

        if (!vResult.length) {
            return Response.json({ error: "Active vehicle not found" }, { status: 404 });
        }

        const vehicleId = vResult[0].id;

        // 2. Lookup Title Record
        const titleResult = await sql`
            SELECT * FROM vehicle_titles WHERE vehicle_id = ${vehicleId} LIMIT 1
        `;

        const titleData = titleResult.length > 0 ? titleResult[0] : null;

        // Package with computed priority status
        const responseData = titleData ? {
            ...titleData,
            computed_status: computeDerivedStatus(titleData)
        } : {
            computed_status: "Not Received",
            mailing_location: "",
            has_lien: false,
            client_notes: "",
            title_number: "",
            tracking_number: "",
            employee_notes: "",
            manual_status: null
        };

        return Response.json({ success: true, data: responseData });
    } catch (error) {
        console.error("[GET Title Tracking error]", error);
        return Response.json({ error: "Failed to fetch title tracking" }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const { vin } = params;
        const body = await request.json();

        // 1. Resolve ACTIVE vehicle_id
        const vResult = await sql`
            SELECT id, client_id FROM vehicles 
            WHERE vin = ${vin} AND master_status != 'cancelled'
            LIMIT 1
        `;

        if (!vResult.length) {
            return Response.json({ error: "Active vehicle not found" }, { status: 404 });
        }

        const vehicleId = vResult[0].id;

        // 2. Check if title record exists
        const existingResult = await sql`
            SELECT * FROM vehicle_titles WHERE vehicle_id = ${vehicleId} LIMIT 1
        `;
        const exists = existingResult.length > 0;
        const currentData = exists ? existingResult[0] : {};

        // 3. Automated Timestamps Logic
        let date_received = body.date_received || currentData.date_received;
        let date_mailed = body.date_mailed || currentData.date_mailed;

        // If title_number is newly entered and no date_received is set yet
        if (body.title_number && !date_received) {
            date_received = new Date().toISOString();
        }
        // If tracking_number is newly entered and no date_mailed is set yet
        if (body.tracking_number && !date_mailed) {
            date_mailed = new Date().toISOString();
        }

        // 4. Data defaults & preparation
        const mailing_location = body.mailing_location !== undefined ? body.mailing_location : currentData.mailing_location;
        const has_lien = body.has_lien !== undefined ? body.has_lien : (currentData.has_lien || false);
        const client_notes = body.client_notes !== undefined ? body.client_notes : currentData.client_notes;
        const title_number = body.title_number !== undefined ? body.title_number : currentData.title_number;
        const tracking_number = body.tracking_number !== undefined ? body.tracking_number : currentData.tracking_number;
        const employee_notes = body.employee_notes !== undefined ? body.employee_notes : currentData.employee_notes;
        const manual_status = body.manual_status !== undefined ? body.manual_status : currentData.manual_status;

        let finalRecord;

        // 5. UPSERT
        if (exists) {
            const updateRes = await sql`
                UPDATE vehicle_titles SET
                    mailing_location = ${mailing_location || null},
                    has_lien = ${has_lien},
                    client_notes = ${client_notes || null},
                    title_number = ${title_number || null},
                    tracking_number = ${tracking_number || null},
                    employee_notes = ${employee_notes || null},
                    manual_status = ${manual_status || null},
                    date_received = ${date_received || null},
                    date_mailed = ${date_mailed || null}
                WHERE vehicle_id = ${vehicleId}
                RETURNING *
            `;
            finalRecord = updateRes[0];
        } else {
            const insertRes = await sql`
                INSERT INTO vehicle_titles (
                    vehicle_id, mailing_location, has_lien, client_notes, 
                    title_number, tracking_number, employee_notes, manual_status,
                    date_received, date_mailed
                ) VALUES (
                    ${vehicleId}, ${mailing_location || null}, ${has_lien}, ${client_notes || null},
                    ${title_number || null}, ${tracking_number || null}, ${employee_notes || null}, ${manual_status || null},
                    ${date_received || null}, ${date_mailed || null}
                )
                RETURNING *
            `;
            finalRecord = insertRes[0];
        }

        return Response.json({
            success: true,
            data: {
                ...finalRecord,
                computed_status: computeDerivedStatus(finalRecord)
            }
        });

    } catch (error) {
        console.error("[PUT Title Tracking error]", error);
        return Response.json({ error: "Failed to update title tracking" }, { status: 500 });
    }
}
