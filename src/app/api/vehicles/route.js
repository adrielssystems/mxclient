import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { logAudit, getRequestInfo, AUDIT_ACTIONS, RESOURCE_TYPES } from "@/utils/auditLogger";
import { decodeVinForSizeClass } from "@/app/api/utils/vinDecoder";
import { z } from "zod";

// Get vehicles based on user role
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const clientId = url.searchParams.get("client_id");
    const search = url.searchParams.get("search") || "";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const statusFilter = url.searchParams.get("status") || "all";
    const auctionFilter = url.searchParams.get("auction") || "all";
    const auctionIdFilter = url.searchParams.get("auction_id") || "all";
    const locationFilter = url.searchParams.get("location") || "all";
    const buyerType = url.searchParams.get("buyer_type") || "all";
    
    // Pagination Guard (OOM Protection)
    const finalLimit = limit > 500 ? 500 : limit;
    const offset = (page - 1) * finalLimit;

    // Get user info
    const userRows = await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
    const user = userRows[0];

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    let vehicles = [];
    let totalCount = 0;

    // Helper for search condition (Strict: VIN, LOT, Description, Invoice Number, Client Name, Client Email)
    const searchCondition = search
      ? sql`AND (v.vin ILIKE ${'%' + search + '%'} OR v.lot_number ILIKE ${'%' + search + '%'} OR v.description ILIKE ${'%' + search + '%'} OR v.invoice_number ILIKE ${'%' + search + '%'} OR u.name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})`
      : sql``;

    let statusCondition = sql``;
    if (statusFilter !== "all") {
      const sqlCanceled = sql`(v.master_status = 'cancelled' OR COALESCE(NULLIF(v.manual_payment_status, 'none'), v.payment_status) = 'canceled' OR COALESCE(NULLIF(v.manual_payment_status, 'none'), v.payment_status) = 'cancelled')`;
      const sqlCheck = sql`(v.needs_review = TRUE OR (v.buyer_pays_auction = FALSE AND COALESCE(v.amount_paid, 0) > 0 AND (COALESCE(v.purchase_price, 0) + (SELECT COALESCE(SUM(amount_paid_by_motor_x), 0) FROM purchase_extra_charges WHERE vin = v.vin AND quickbooks_invoice_number IS NULL AND (non_billable = FALSE OR non_billable IS NULL)) - COALESCE(v.amount_paid, 0)) > 0))`;
      const sqlPaid = sql`COALESCE(NULLIF(v.manual_payment_status, 'none'), v.payment_status) = 'paid'`;
      const sqlNew = sql`(v.invoice_number IS NULL OR v.invoice_number = '')`;
      const sqlLate = sql`v.purchase_date < CURRENT_DATE - 3`;

      if (statusFilter === "canceled" || statusFilter === "cancelled") {
        statusCondition = sql`AND ${sqlCanceled}`;
      } else if (statusFilter === "check") {
        statusCondition = sql`AND NOT ${sqlCanceled} AND ${sqlCheck}`;
      } else if (statusFilter === "paid") {
        statusCondition = sql`AND NOT ${sqlCanceled} AND NOT ${sqlCheck} AND ${sqlPaid}`;
      } else if (statusFilter === "new") {
        statusCondition = sql`AND NOT ${sqlCanceled} AND NOT ${sqlCheck} AND NOT ${sqlPaid} AND ${sqlNew}`;
      } else if (statusFilter === "late") {
        statusCondition = sql`AND NOT ${sqlCanceled} AND NOT ${sqlCheck} AND NOT ${sqlPaid} AND NOT ${sqlNew} AND ${sqlLate}`;
      } else if (statusFilter === "pending") {
        statusCondition = sql`AND NOT ${sqlCanceled} AND NOT ${sqlCheck} AND NOT ${sqlPaid} AND NOT ${sqlNew} AND NOT ${sqlLate}`;
      } else if (statusFilter === "auction" || statusFilter === "auction_followup") {
        statusCondition = sql`AND COALESCE(NULLIF(v.manual_payment_status, 'none'), v.payment_status) = 'paid' AND (v.amount_paid IS NULL OR v.amount_paid = 0) AND v.buyer_pays_auction = FALSE`;
      } else if (statusFilter === "extra_fee") {
        statusCondition = sql`AND (SELECT COALESCE(SUM(amount_paid_by_motor_x), 0) FROM purchase_extra_charges WHERE vin = v.vin AND quickbooks_invoice_number IS NULL AND (non_billable = FALSE OR non_billable IS NULL)) > 0`;
      } else if (statusFilter.includes(',')) {
        const statuses = statusFilter.split(',');
        statusCondition = sql`AND (v.current_status = ANY(${statuses}) OR v.master_status = ANY(${statuses}))`;
      } else {
        statusCondition = sql`AND (v.current_status = ${statusFilter} OR v.master_status = ${statusFilter})`;
      }
    }

    let buyerTypeCondition = sql``;
    if (buyerType === "mx") {
      buyerTypeCondition = sql`AND v.buyer_pays_auction = FALSE`;
    } else if (buyerType === "buyer") {
      buyerTypeCondition = sql`AND v.buyer_pays_auction = TRUE`;
    }

    let auctionCondition = sql``;
    if (auctionIdFilter && auctionIdFilter !== "all" && auctionIdFilter !== "") {
      auctionCondition = sql`AND v.auction_id = ${auctionIdFilter}`;
    } else if (auctionFilter !== "all" && auctionFilter !== "") {
      auctionCondition = sql`AND a.name = ${auctionFilter}`;
    }

    let locationCondition = sql``;
    if (locationFilter && locationFilter !== "all") {
      if (locationFilter.includes(',')) {
        const locationsList = locationFilter.split(',');
        locationCondition = sql`AND l.name = ANY(${locationsList})`;
      } else {
        locationCondition = sql`AND l.name = ${locationFilter}`;
      }
    }

    const dealerParam = url.searchParams.get('dealer');
    let dealerCondition = sql``;
    if (dealerParam && dealerParam !== "all") {
      if (dealerParam === "motorx") {
        dealerCondition = sql`AND v.dl_number IS NOT NULL`;
      } else if (dealerParam === "external") {
        dealerCondition = sql`AND v.dl_number IS NULL`;
      } else {
        dealerCondition = sql`AND v.dl_number = ${dealerParam}`;
      }
    }

    const clientFilterId = url.searchParams.get('client_id');
    const clientCondition = clientFilterId && clientFilterId !== "all"
      ? sql`AND v.client_id = ${clientFilterId}`
      : sql``;

    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    let dateCondition = sql``;
    if (startDate && endDate) {
      dateCondition = sql`AND v.purchase_date BETWEEN ${startDate} AND ${endDate}`;
    } else if (startDate) {
      dateCondition = sql`AND v.purchase_date >= ${startDate}`;
    } else if (endDate) {
      dateCondition = sql`AND v.purchase_date <= ${endDate}`;
    }

    let roleCondition = sql``;
    if (user.role === "admin") {
         roleCondition = (clientId && clientId !== "all") ? sql`AND v.client_id = ${clientId}` : sql``;
    } else if (user.is_main_client) {
         roleCondition = sql`AND (v.client_id = ${session.user.id} OR v.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${session.user.id}))`;
    } else {
         roleCondition = sql`AND v.client_id = ${session.user.id}`;
    }

    const whereClause = sql`WHERE 1=1
        ${roleCondition}
        ${searchCondition}
        ${statusCondition}
        ${auctionCondition}
        ${locationCondition}
        ${dealerCondition}
        ${clientCondition}
        ${dateCondition}
        ${buyerTypeCondition}`;

    // Get Total Count for Pagination
    const countResult = await sql`
      SELECT COUNT(*) 
      FROM vehicles v
      LEFT JOIN auth_users u ON v.client_id = u.id
      LEFT JOIN auctions a ON v.auction_id = a.id
      LEFT JOIN locations l ON v.location_id = l.id
      ${whereClause}
    `;
    totalCount = parseInt(countResult[0]?.count || 0, 10);

    // Get Paginated Vehicles
    vehicles = await sql`
      SELECT 
        v.*,
        v.buyer_pays_auction,
        v.invoice_number,
        v.amount_paid,
        v.payment_status,
        v.payment_date,
        v.buyer_payment_method,
        u.name as client_name,
        u.email as client_email,
        u.price_level as client_price_level,
        a.name as auction_name,
        l.name as location_name,
        l.name as auction_location,
        st.name as terminal_name,
        d.country_name as destination_name,
        (SELECT COALESCE(SUM(amount_paid_by_motor_x), 0) FROM purchase_extra_charges WHERE vin = v.vin) as extra_charges_sum,
        (SELECT COALESCE(json_agg(pec.*), '[]'::json) FROM purchase_extra_charges pec WHERE pec.vin = v.vin) as extra_charges,
        CASE WHEN v.buyer_pays_auction = TRUE THEN 0.00 ELSE COALESCE(v.purchase_price, 0) END as to_be_paid,
        (CASE WHEN v.buyer_pays_auction = TRUE THEN 0.00 ELSE COALESCE(v.purchase_price, 0) END + (SELECT COALESCE(SUM(amount_paid_by_motor_x), 0) FROM purchase_extra_charges WHERE vin = v.vin AND quickbooks_invoice_number IS NULL AND (non_billable = FALSE OR non_billable IS NULL)) - COALESCE(v.amount_paid, 0)) as difference,
        (SELECT COALESCE(SUM(amount), 0) FROM invoice_line_items WHERE vehicle_id = v.id AND description ILIKE '%Transport%') as dispatch_price,
        (SELECT COALESCE(SUM(amount), 0) FROM invoice_line_items WHERE vehicle_id = v.id AND invoice_id IS NULL) as unbilled_costs,
        (
          SELECT COALESCE(SUM(amount), 0) + 
          CASE 
            WHEN NOT EXISTS (SELECT 1 FROM invoice_line_items WHERE vehicle_id = v.id AND invoice_id IS NULL AND (type = 'PURCHASE' OR description ILIKE '%Purchase%'))
            THEN COALESCE(v.purchase_price, 0)
            ELSE 0 
          END
          FROM invoice_line_items WHERE vehicle_id = v.id AND invoice_id IS NULL
        ) as total_pending_cost,
        -- Dispatch display status (mirrors dispatch board JS engine in SQL)
        CASE
          WHEN v.dispatch_status = 'not_applicable' THEN NULL
          WHEN ld.vehicle_id IS NULL THEN 'Pending'
          WHEN (
            ld.actual_delivery_date IS NOT NULL
            AND ld.transporter_payment_date IS NOT NULL
            AND (
              NULLIF(TRIM(COALESCE(v.invoice_number, '')), '') IS NOT NULL
              OR NULLIF(TRIM(COALESCE(di.dispatch_inv_number, '')), '') IS NOT NULL
            )
          ) THEN 'Completed'
          WHEN (
            ld.actual_delivery_date IS NOT NULL
            OR NULLIF(TRIM(COALESCE(di.dispatch_inv_number, '')), '') IS NOT NULL
          ) THEN 'INVOICE'
          WHEN ld.estimated_delivery_date::date < CURRENT_DATE THEN 'Late'
          WHEN ld.estimated_delivery_date::date = CURRENT_DATE THEN 'Today'
          WHEN (ld.actual_pickup_date IS NOT NULL OR ld.picked_up = TRUE) THEN 'In Transit'
          ELSE 'New'
        END as dispatch_display_status,
        -- Title Service display status (mirrors calculateTitleStatus() JS engine in SQL)
        CASE
          WHEN lt.ts_id IS NULL THEN NULL
          WHEN lt.ts_manual_status = 'Canceled' THEN 'Canceled'
          WHEN (lt.ts_manual_status IS NOT NULL AND lt.ts_manual_status != 'none') THEN lt.ts_manual_status
          WHEN (
            (lt.ts_date_mailed_out IS NOT NULL OR (lt.ts_mailing_out_tracking IS NOT NULL AND lt.ts_mailing_out_tracking != ''))
            AND (lt.ts_invoice_number IS NOT NULL AND lt.ts_invoice_number != '')
            AND lt.ts_invoice_payment_status = 'paid'
          ) THEN 'Completed'
          WHEN (lt.ts_date_mailed_out IS NOT NULL OR (lt.ts_mailing_out_tracking IS NOT NULL AND lt.ts_mailing_out_tracking != '')) THEN 'NOT PAID'
          WHEN (lt.ts_date_received IS NOT NULL AND (lt.ts_invoice_number IS NULL OR lt.ts_invoice_number = '')) THEN 'INVOICE'
          WHEN lt.ts_date_received IS NOT NULL THEN 'Received'
          WHEN (lt.ts_date_mailing_in IS NOT NULL OR (lt.ts_mailing_in_tracking IS NOT NULL AND lt.ts_mailing_in_tracking != '')) THEN 'Mailing IN'
          WHEN lt.ts_date_approved IS NOT NULL THEN 'Approved'
          WHEN lt.ts_date_requested IS NOT NULL THEN 'Requested'
          ELSE 'New'
        END as title_service_status
        ${user.role !== 'admin' && user.is_main_client ? sql`, CASE WHEN v.client_id = ${session.user.id} THEN 'own' ELSE 'sub_client' END as ownership_type` : sql``}
      FROM vehicles v
      LEFT JOIN auth_users u ON v.client_id = u.id
      LEFT JOIN auctions a ON v.auction_id = a.id
      LEFT JOIN locations l ON v.location_id = l.id
      LEFT JOIN shippers_terminals st ON v.terminal_id = st.id
      LEFT JOIN destinations d ON v.destination_id = d.id
      -- Latest dispatch order per vehicle
      LEFT JOIN (
        SELECT DISTINCT ON (vehicle_id)
          vehicle_id,
          actual_delivery_date,
          transporter_payment_date,
          actual_pickup_date,
          picked_up,
          estimated_delivery_date
        FROM dispatch_orders
        ORDER BY vehicle_id, created_at DESC
      ) ld ON ld.vehicle_id = v.id
      -- Dispatch invoice per vehicle
      LEFT JOIN (
        SELECT DISTINCT ON (vehicle_id)
          vehicle_id,
          invoice_number as dispatch_inv_number
        FROM invoices
        WHERE service_category = 'DISPATCH'
        ORDER BY vehicle_id, created_at DESC
      ) di ON di.vehicle_id = v.id
      -- Latest title service record per vehicle
      LEFT JOIN (
        SELECT DISTINCT ON (vts.vehicle_id)
          vts.vehicle_id,
          vts.id as ts_id,
          vts.manual_status as ts_manual_status,
          vts.date_requested as ts_date_requested,
          vts.date_approved as ts_date_approved,
          vts.date_mailing_in as ts_date_mailing_in,
          vts.mailing_in_tracking as ts_mailing_in_tracking,
          vts.date_received as ts_date_received,
          vts.date_mailed_out as ts_date_mailed_out,
          vts.mailing_out_tracking as ts_mailing_out_tracking,
          vts.invoice_number as ts_invoice_number,
          i.status as ts_invoice_payment_status
        FROM vehicle_title_services vts
        LEFT JOIN invoices i ON i.vehicle_id = vts.vehicle_id 
          AND i.service_category = 'TITLE' 
          AND (vts.invoice_number IS NOT NULL AND i.invoice_number = vts.invoice_number)
        ORDER BY vts.vehicle_id, vts.created_at DESC
      ) lt ON lt.vehicle_id = v.id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT ${finalLimit} OFFSET ${offset}
    `;


    // Derive purchase_source and apply automated Status Logic: Check for Late Payments (3 Days)
    vehicles = vehicles.map(v => {
      const motorxMethods = ['CSV_IMPORT', 'BOT_API', 'MANUAL'];
      if (motorxMethods.includes(v.entry_method)) {
        v.purchase_source = 'MotorX';
      } else {
        v.purchase_source = (v.entry_method === 'CLIENT_PORTAL' || v.external_service || (!v.entry_method && !v.dl_number)) ? 'External' : 'MotorX';
      }

      const toBePaidAmt = v.buyer_pays_auction ? 0.00 : parseFloat(v.to_be_paid || 0);
      const amountPaidAmt = parseFloat(v.amount_paid || 0);
      const differenceAmt = parseFloat(v.difference || 0);

      // Priority: Manual Overwrite
      if (v.manual_payment_status && v.manual_payment_status !== 'none') {
        v.payment_status = v.manual_payment_status.toLowerCase();
        if (v.master_status === 'cancelled' || v.payment_status === 'canceled' || v.payment_status === 'cancelled') {
          v.payment_status = 'canceled';
        }
      } else {
        if (v.master_status === 'cancelled' || v.payment_status === 'canceled' || v.payment_status === 'cancelled') {
          v.payment_status = 'canceled';
        } else if (v.needs_review || (v.buyer_pays_auction === false && amountPaidAmt > 0 && differenceAmt > 0)) {
          v.payment_status = 'check';
        } else if (v.payment_status === 'paid') {
          v.payment_status = 'paid';
        } else if (!v.invoice_number) {
          v.payment_status = 'new';
        } else if (v.purchase_date) {
          const purchaseDate = new Date(v.purchase_date);
          const now = new Date();
          // Reset to UTC midnight to calculate exact calendar days and avoid timezone shifts
          const utcPurch = Date.UTC(purchaseDate.getUTCFullYear(), purchaseDate.getUTCMonth(), purchaseDate.getUTCDate());
          const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
          const diffDays = Math.floor((utcNow - utcPurch) / (1000 * 60 * 60 * 24));
          if (diffDays > 3) {
            v.payment_status = 'late';
          } else {
            v.payment_status = 'pending';
          }
        } else {
          v.payment_status = 'pending';
        }
      }
      return v;
    });

    return Response.json({ vehicles, totalCount });
  } catch (error) {
    console.error("GET /api/vehicles error:", error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}

// Create new vehicle
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // 1. Zod Validation
    const vehicleSchema = z.object({
      vin: z.string().length(17, "VIN must be exactly 17 characters").toUpperCase(),
      auction_id: z.number().int({ message: "Auction is required" }),
      location_id: z.number().int({ message: "Current Location is required" }),
      purchase_date: z.string().min(1, "Purchase Date is required"),
      description: z.string().min(1, "Description is required"),
      purchase_price: z.number({ invalid_type_error: "Purchase Price must be a number" }).positive("Purchase Price must be positive"),
      client_id: z.string().min(1, "Client is required"),
      buyer_number: z.string().min(1, "Buyer # is required"),
      dealer: z.enum(['AR', 'WI', ''], { errorMap: () => ({ message: "Select a valid Dealer (AR, WI, or N/A)" }) }).nullable().optional(),
      
      // Optional/Nullable fields from mockup
      lot_number: z.string().optional().nullable(),
      pin_number: z.string().optional().nullable(),
      
      // Optional Service Flags & Data
      wants_dispatch: z.boolean().optional().default(false),
      destination_hub: z.string().optional().nullable(),
      specific_terminal_id: z.number().int().optional().nullable(),
      
      wants_shipping: z.boolean().optional().default(false),
      shipping_destination_id: z.number().int().optional().nullable(),
      
      wants_title_service: z.boolean().optional().default(false),
      title_service_id: z.number().int().optional().nullable()
    });

    const parsedBody = vehicleSchema.safeParse(body);
    if (!parsedBody.success) {
      return Response.json({ error: "Validation Error", details: parsedBody.error.format() }, { status: 400 });
    }

    let {
      vin,
      auction_id,
      location_id,
      purchase_date,
      description,
      purchase_price,
      client_id,
      buyer_number,
      dealer,
      lot_number,
      pin_number,
      wants_dispatch,
      destination_hub,
      specific_terminal_id,
      wants_shipping,
      shipping_destination_id,
      wants_title_service,
      title_service_id
    } = parsedBody.data;

    // N/A dealer = null dl_number (external vehicle, not MotorX property)
    const dl_number = dealer && dealer !== '' ? dealer : null;

    // 2. Client Resolution Logic (Legacy/Conditional)
    // Note: If client_id is provided directly from frontend (Admin choice), we use it.
    // The previous purchase_source logic is kept ONLY if client_id was empty, but now it's required.
    // So we'll skip the ETL logic for new manual entries if client_id is already set.
    if (!client_id && buyer_name) {
      // ... (existing logic) ...
    }

    let needs_review = false;
    let review_reasons = [];

    // Check if VIN already exists
    const existingVehicle = await sql`SELECT id FROM vehicles WHERE vin = ${vin}`;
    if (existingVehicle.length > 0) {
        needs_review = true;
        review_reasons.push("DUPLICATE VIN");
    }

    let review_reason = review_reasons.length > 0 ? review_reasons.join(" | ") : null;

    // Get user info to check permissions
    const userRows =
      await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
    const user = userRows[0];

    // Check if user can create vehicle for this client
    if (user.role !== "admin") {
      if (client_id !== session.user.id) {
        // Check if it's a main client creating for their sub-client
        if (!user.is_main_client) {
          return Response.json(
            { error: "Forbidden - Cannot create vehicle for other clients" },
            { status: 403 },
          );
        }

        const hierarchyCheck = await sql`
          SELECT id FROM client_hierarchy 
          WHERE main_client_id = ${session.user.id} AND sub_client_id = ${client_id}
        `;

        if (hierarchyCheck.length === 0) {
          return Response.json(
            { error: "Forbidden - Cannot create vehicle for this client" },
            { status: 403 },
          );
        }
      }
    }

    // Determine entry method based on user role
    const entry_method = user.role === 'client' ? 'CLIENT_PORTAL' : 'ADMIN_MANUAL';
    const external_service = user.role === 'client';

    // Detect Client Details for Rules/Financials
    // buyer_payment: client pays auction directly → no purchase price in invoice (alternate calculation per spec §7)
    const clientData = await sql`SELECT id, is_main_client, main_client_id, price_level, buyer_payment FROM auth_users WHERE id = ${client_id}`;
    const targetClient = clientData[0];
    const clientBuyerPayment = targetClient?.buyer_payment || false;

    // Logic Variables (to be populated)
    let rule = null;
    let clientPaysAuction = false;
    let dispatchCost = 0;

    if (targetClient && auction_id) {
      const targetMainClientId = targetClient.is_main_client ? targetClient.id : targetClient.main_client_id;
      const clientGlobalPriceLevel = targetClient.price_level || 'L3';

      // FETCH SPECIFIC CONFIG FOR DISPATCH
      const dispatchConfigRes = await sql`
        SELECT price_level FROM client_service_config 
        WHERE client_id = ${targetClient.id} AND service_category = 'DISPATCH'
      `;
      const dispatchPriceLevel = dispatchConfigRes[0]?.price_level || clientGlobalPriceLevel;

      // Get Auction Provider Name
      const auctionData = await sql`SELECT name FROM auctions WHERE id = ${auction_id}`;
      const auctionProvider = auctionData[0]?.name;

      if (targetMainClientId && auctionProvider) {
          const rules = await sql`
            SELECT * FROM client_auction_rules 
            WHERE client_id = ${targetMainClientId} 
            AND LOWER(auction_provider) = LOWER(${auctionProvider})
          `;
          rule = rules[0];
          clientPaysAuction = (rule?.buyer_pays_auction || clientBuyerPayment) ? true : false;
      }

      // Spec §7: If operational rule has motorx_pickup = true, auto-trigger Dispatch
      // regardless of what the operator selected from the UI.
      if (rule?.motorx_pickup && !wants_dispatch) {
        wants_dispatch = true;
      }

      // Calculate Dispatch Cost if requested
      if (wants_dispatch && specific_terminal_id) {
          const tariff = await sql`
              SELECT price_l1, price_l2, price_l3 
              FROM tariff_master 
              WHERE service_type = 'DISPATCH' 
                AND origin_ref_id = ${auction_id} 
                AND destination_ref_id = ${specific_terminal_id}
           `;
          if (tariff.length > 0) {
            if (dispatchPriceLevel === 'L1') dispatchCost = tariff[0].price_l1;
            else if (dispatchPriceLevel === 'L2') dispatchCost = tariff[0].price_l2;
            else dispatchCost = tariff[0].price_l3;
          }
      }
    }

    // FORCE Initial Statuses
    let masterStatus = 'entered';
    let purchaseStatus = 'payment_pending';
    let dispatchStatus = wants_dispatch ? 'assignment_pending' : 'not_applicable';
    let titleStatus = wants_title_service ? 'processing' : 'waiting_documents';
    let shippingStatus = wants_shipping ? 'not_applicable' : 'not_applicable'; // Ocean will start later if requested


    const newVehicle = await sql`
      INSERT INTO vehicles (
        vin, client_id, description, auction_id, location_id, terminal_id, destination_id, purchase_price, purchase_date, 
        current_status,
        lot_number,
        master_status, purchase_status, dispatch_status, title_status,
        pin_number, buyer_number, needs_review, review_reason, dl_number,
        entry_method, external_service, buyer_pays_auction
      ) VALUES (
        ${vin}, ${client_id}, ${description}, ${auction_id}, ${location_id},
        ${specific_terminal_id || null}, ${shipping_destination_id || null},
        ${purchase_price}, ${purchase_date}, 
        ${masterStatus},
        ${lot_number || null},
        ${masterStatus}, ${purchaseStatus}, ${dispatchStatus}, ${titleStatus},
        ${pin_number || null}, ${buyer_number}, ${needs_review}, ${review_reason}, ${dl_number},
        ${entry_method}, ${user.role === 'client'}, ${clientPaysAuction}
      )
      RETURNING *
    `;
    const vehicleId = newVehicle[0].id;

    // --- NEW: NHTSA VIN DECODING FOR SIZE CLASS ---
    try {
      const decodedSize = await decodeVinForSizeClass(vin);
      await sql`UPDATE vehicles SET size_class = ${decodedSize.size_class} WHERE id = ${vehicleId}`;
      newVehicle[0].size_class = decodedSize.size_class; // Update local copy for audit & return
    } catch (decodeErr) {
      console.error(`[Vehicle POST] NHTSA Decode failed for ${vin}:`, decodeErr);
    }
    // --- END NEW ---

    // 4. Post-Creation Actions (Financials & Services)

    // A. Create Internal Payable (if MotorX pays)
    if (rule && !rule.buyer_pays_auction && purchase_price) {
      // Estimated Payable: Purchase Price
      await sql`
            INSERT INTO accounts_payable (vehicle_id, vendor_name, description, amount, status)
            VALUES (${vehicleId}, ${rule.auction_provider}, 'Vehicle Purchase Price (Estimated)', ${purchase_price}, 'pending')
        `;
    }

    // ... (Fees Logic) ...
    // B. Insert Fees into Invoice Line Items
    if (rule) {
      const fees = [
        { name: 'Broker Fee', amount: rule.broker_fee },
        { name: 'Gate Fee', amount: rule.gate_fee },
        { name: 'Wire Fee', amount: rule.wire_fee },
        { name: 'Client Markup Fee', amount: rule.client_markup_fee }
      ];

      // Spec §7: Alternate invoice calculation
      // buyer_pays_auction (rule-level) OR buyer_payment (client profile level) = client pays auction directly
      // In both cases: do NOT add purchase price to invoice
      const clientPaysAuction = rule.buyer_pays_auction || clientBuyerPayment;

      // If MotorX Pays Auction, Client owes MotorX the Vehicle Price
      if (purchase_price) {
        fees.unshift({ name: 'Vehicle Purchase Price', amount: purchase_price });
        if (clientPaysAuction) {
          fees.push({ name: 'Client pay to the auction', amount: -purchase_price });
        }
      }

      for (const fee of fees) {
        if (fee.amount !== 0) {
          await sql`
                    INSERT INTO invoice_line_items (vehicle_id, description, amount, type)
                    VALUES (${vehicleId}, ${fee.name}, ${fee.amount}, 'FEE')
                `;
        }
      }
    }

    // Add Dispatch Cost if calculated
    if ((rule?.motorx_pickup || external_service) && dispatchCost > 0) {
      await sql`
              INSERT INTO invoice_line_items (vehicle_id, description, amount, type)
              VALUES (${vehicleId}, 'Inland Transport', ${dispatchCost}, 'SERVICE')
          `;
    }

    // 4. Create initial service records based on flags
    const servicesList = await sql`SELECT id, name, category FROM services WHERE is_active = true`;

    for (const service of servicesList) {
      const serviceName = service.name.toLowerCase();
      let shouldCreate = false;
      let initialStatus = 'pending';

      // 1. Purchase: Always Create
      if (service.category === 'PURCHASE' && serviceName.includes('wholesale')) {
        shouldCreate = true;
        initialStatus = (purchaseStatus === 'not_applicable') ? 'not_applicable' : 'pending';
      }

      // 2. Dispatch
      else if (wants_dispatch && (service.category === 'DISPATCH' && serviceName.includes('transportation'))) {
        shouldCreate = true;
        initialStatus = 'assignment_pending';
      }

      // 3. Shipping
      else if (wants_shipping && (service.category === 'SHIPPING' && serviceName.includes('ocean'))) {
        shouldCreate = true;
        initialStatus = 'pending';
      }

      // 4. Title Service (choose specific service if provided)
      else if (wants_title_service && title_service_id === service.id) {
        shouldCreate = true;
        initialStatus = 'processing';
      }

      if (shouldCreate) {
        await sql`
            INSERT INTO vehicle_service_details (vehicle_id, service_id, status)
            VALUES (${vehicleId}, ${service.id}, ${initialStatus})
          `;
      }
    }

    // Log audit event
    const { ipAddress, userAgent } = getRequestInfo(request);
    const currentUserData = await sql`SELECT name, email, role FROM auth_users WHERE id = ${session.user.id}`;

    // Get client email for descriptive resource display
    const clientEmailData = await sql`SELECT email FROM auth_users WHERE id = ${client_id}`;
    const resourceDisplay = `${vin} | ${clientEmailData[0]?.email || 'Unknown'} | ${masterStatus}`;

    await logAudit({
      userId: session.user.id,
      userName: currentUserData[0]?.name,
      userEmail: currentUserData[0]?.email,
      userRole: currentUserData[0]?.role,
      action: AUDIT_ACTIONS.VEHICLE_CREATE,
      resourceType: RESOURCE_TYPES.VEHICLE,
      resourceId: resourceDisplay,
      details: {
        vin,
        client_id,
        description,
        auction_id,
        purchase_price,
        lot_number,
        external_service,
        master_status: masterStatus,
        purchase_status: purchaseStatus,
        dispatch_status: dispatchStatus,
        applied_rules: rule ? true : false,
        fees_generated: rule ? true : false,
        size_class: newVehicle[0].size_class // Log the auto-detected size
      },
      ipAddress,
      userAgent,
      status: 'success'
    });

    // Fetch the complete vehicle record with joins to return friendly names
    const vehicleWithDetails = await sql`
      SELECT 
        v.*,
        u.name as client_name,
        u.email as client_email,
        u.price_level as client_price_level,
        a.name as auction_name,
        l.name as location_name,
        l.name as auction_location,
        st.name as terminal_name,
        d.country_name as destination_name
      FROM vehicles v
      LEFT JOIN auth_users u ON v.client_id = u.id
      LEFT JOIN auctions a ON v.auction_id = a.id
      LEFT JOIN locations l ON v.location_id = l.id
      LEFT JOIN shippers_terminals st ON v.terminal_id = st.id
      LEFT JOIN destinations d ON v.destination_id = d.id
      WHERE v.id = ${vehicleId}
    `;

    return Response.json({ vehicle: vehicleWithDetails[0] });
  } catch (error) {
    console.error("POST /api/vehicles error:", error);
    return Response.json({
      error: process.env.NODE_ENV === 'production'
        ? "Failed to create vehicle"
        : error.message
    }, { status: 500 });
  }
}
