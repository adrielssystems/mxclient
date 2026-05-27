import { 
    Home, DollarSign, ScrollText, Truck, FileCheck, Car, Shield, 
    CreditCard, FileText, Database, Building, Ship, Globe, Users, 
    Gavel, Settings as SettingsIcon
} from 'lucide-react';

/**
 * appGuideData.js - COMPREHENSIVE EDITION
 * Detailed, non-technical instructional content for the entire MotorX Admin Panel.
 */
export const APP_GUIDE_CONTENT = {
    // ── MAIN MODULES ───────────────────────────────────────────────────────────
    overview: {
        id: 'overview',
        title: 'Operations Overview',
        icon: Home,
        description: 'Your real-time command center for MotorX operations.',
        basics: [
            'Monitor key performance indicators (KPIs) like total vehicles and pending payments.',
            'Identify operational bottlenecks before they become problems.',
            'Quickly navigate to specific work queues by clicking on status cards.'
        ],
        tips: 'The colors represent urgency: Red typically means an action is overdue (Late), while Amber means it is pending attention.'
    },
    vehicles: {
        id: 'vehicles',
        title: 'Master Vehicle List',
        icon: Car,
        description: 'The search engine for every vehicle recorded in the system.',
        basics: [
            'Locate any vehicle using the full VIN, Lot number, or partial description.',
            'Click on a vehicle to see its entire lifespan (logistics, titles, and payments).',
            'Filter by client or status to generate customized lists for follow-up.'
        ],
        tips: "If you can't find a vehicle by Lot#, try searching the last 6 digits of the VIN for more accuracy."
    },
    payments: {
        id: 'payments',
        title: 'Payments Tracking',
        icon: CreditCard,
        description: 'Centralized view of all financial transactions and balances.',
        basics: [
            'Track payments received from clients and payments made to auctions.',
            'Review upcoming billing deadlines to maintain a healthy cash flow.',
            'Reconcile daily income against operational costs.'
        ],
        tips: 'Use this section to verify if a client has enough credit or paid for their logistics before allowing a release.'
    },
    reports: {
        id: 'reports',
        title: 'Business Reports',
        icon: FileText,
        description: 'Deep insights into company performance and volume.',
        basics: [
            'Export data to Excel or PDF for meetings or accounting reviews.',
            'Analyze volume trends by auction source or destination country.',
            'Review financial summaries to assess profitability by service category.'
        ],
        tips: 'Reports are generated based on the filters you set; always double-check your date ranges.'
    },
    migrate: {
        id: 'migrate',
        title: 'Data Migration',
        icon: Database,
        description: 'Tools for importing historical data and legacy records.',
        basics: [
            'Import vehicles from old spreadsheets or external systems.',
            'Clean and map old data to the new MotorX professional structure.',
            'Ensure historical records are preserved during system transitions.'
        ],
        tips: 'Only used during administrative transitions or when bringing in high-volume legacy clients.'
    },

    // ── OPERATIONAL MODULES ────────────────────────────────────────────────────
    op_purchases: {
        id: 'op_purchases',
        title: 'Purchases Board',
        icon: DollarSign,
        description: 'High-density queue for managing vehicle acquisitions.',
        basics: [
            'Verify that auctions are paid on time to avoid storage fees.',
            'Resolve "CHECK" records where the system couldn\'t automatically identify the client.',
            'Monitor vehicles with "Duplicate VIN" alerts in the Needs Review tab.'
        ],
        tips: 'Resolving a "CHECK" client here will update the vehicle record globally and trigger the next logistic steps.'
    },
    op_title_log: {
        id: 'op_title_log',
        title: 'Title Tracking Log',
        icon: ScrollText,
        description: 'Control the physical movement and digitization of ownership titles.',
        basics: [
            'Confirm the arrival of physical titles at the MotorX office.',
            'Store the digital PDF of the title (Mandatory) for client transparency.',
            'Log outbound tracking numbers when titles are mailed to customers or terminals.'
        ],
        tips: 'A physical title is the original "birth certificate" of the car; without it, the car cannot be exported.'
    },
    op_dispatch: {
        id: 'op_dispatch',
        title: 'Inland Dispatch',
        icon: Truck,
        description: 'Manage the land transport (trucking) from auctions to terminals.',
        basics: [
            'Assign a Transport Company (Carrier) to pick up the vehicle from the auction.',
            'Confirm when the vehicle has been successfully picked up and delivered.',
            'Adjust transport rates to ensure profit margins are maintained.'
        ],
        tips: 'Check the "Storage" field frequently; if a driver delays the pick-up, the auction might charge daily fees.'
    },
    op_title_services: {
        id: 'op_title_services',
        title: 'Title Special Services',
        icon: FileCheck,
        description: 'Handling complex title issues and special administrative requests.',
        basics: [
            'Request duplicate titles for lost documents or salvage conversions.',
            'Manage "Title Repair" processes for incorrectly filled documents.',
            'Track special fees and administrative approvals for these edge cases.'
        ],
        tips: 'These services are billed separately from standard shipping costs.'
    },

    // ── CONFIGURATION MODULES ──────────────────────────────────────────────────
    tariffs: {
        id: 'tariffs',
        title: 'Tariff Manager',
        icon: DollarSign,
        description: 'The pricing brain of the company.',
        basics: [
            'Set standard prices for transport (Dispatch) and ocean shipping.',
            'Configure hierarchical pricing levels (L1, L2, L3) for different types of clients.',
            'Apply seasonal price adjustments across all routes simultaneously.'
        ],
        tips: 'Updating a price here will affect the automatic billing of all future vehicle registrations.'
    },
    auctions_locations: {
        id: 'auctions_locations',
        title: 'Auctions & Locations',
        icon: Building,
        description: 'Directory of where we buy vehicles (Copart, IAAI, etc.).',
        basics: [
            'Add new auction houses or individual lot locations.',
            'Manage contact information and specific gate-pass requirements for each lot.',
            'Organize locations by state to help the Dispatch team group pick-ups.'
        ],
        tips: 'Make sure the address is 100% correct, as carriers use this info for GPS navigation.'
    },
    terminals: {
        id: 'terminals',
        title: 'Shipping Terminals',
        icon: Ship,
        description: 'The ports and yards where vehicles are stored before shipping.',
        basics: [
            'Configure the different yards we use in major port cities (Savannah, Houston, etc.).',
            'Specify which terminals handle specific export types.',
            'Keep terminal contact and delivery hours up to date.'
        ],
        tips: 'A terminal is usually the "End of the Road" for the Inland Dispatch team and the "Start" for Ocean Shipping.'
    },
    destinations: {
        id: 'destinations',
        title: 'World Destinations',
        icon: Globe,
        description: 'Final ports and countries where we deliver vehicles.',
        basics: [
            'Add new international ports and country configurations.',
            'Assign default ports to specific clients to speed up registration.',
            'Manage regional requirements for specific export markets.'
        ],
        tips: 'Setting a "Preferred Destination" for a client saves time during every new purchase entry.'
    },
    carriers: {
        id: 'carriers',
        title: 'Transport Carriers',
        icon: Truck,
        description: 'Database of reliable truck drivers and transport companies.',
        basics: [
            'Store contact details and insurance information for carriers.',
            'Track how many assignments each carrier has completed.',
            'Mark carriers as "Active" or "Inactive" based on their performance.'
        ],
        tips: "Keeping a carrier's email updated is vital for sending them automated Dispatch Orders."
    },
    clients: {
        id: 'clients',
        title: 'Customer Directory',
        icon: Users,
        description: 'Manage profiles, access, and specific settings for your clients.',
        basics: [
            'Create new client accounts and set their system permissions.',
            'Configure custom "Mark-up Fees" (extra profit) for specific customers.',
            'Assign clients to hierarchy groups (Master Clients vs. Sub-players).'
        ],
        tips: 'From here, you can see a "Client Summary" of their total debt and active inventory.'
    },
    client_rules: {
        id: 'client_rules',
        title: 'Operational Rules',
        icon: Gavel,
        description: 'Fine-tune how the system behaves for different customers.',
        basics: [
            'Configure which clients pay the auction directly vs. thru MotorX.',
            'Set automatic billing triggers for specific services.',
            'Define custom fees (Wire fees, Gate fees) per auction house.'
        ],
        tips: 'Rules here automate your billing; if a client is being overcharged, check their Op. Rules first.'
    },
    services: {
        id: 'services',
        title: 'Additional Services',
        icon: SettingsIcon,
        description: 'Catalog of extra services like storage, cleaning, or repairs.',
        basics: [
            'Add or edit the name and category of extra services.',
            'Link services to QuickBooks items for seamless accounting sync.',
            'Define if a service should be applied automatically to every car.'
        ],
        tips: 'Only "Active" services will appear in the drop-down menus across the app.'
    },
    settings: {
        id: 'settings',
        title: 'System Settings',
        icon: Shield,
        description: 'Technical and security controls for the administrator.',
        basics: [
            'Manage QuickBooks integration status and tokens.',
            'Review system-wide audit logs to see who changed what and when.',
            'Monitor the health of automated notification services (Email/SMS).'
        ],
        tips: 'Use the Audit Logs if you need to investigate a "mysterious" change in a vehicle record.'
    }
};

/**
 * MOTORX INDUSTRY GLOSSARY
 */
export const GLOSSARY_CONTENT = [
    { term: 'VIN', definition: 'Vehicle Identification Number. The unique 17-character DNA of every car.' },
    { term: 'Lot Number', definition: 'The specific identification number assigned by the auction house to a vehicle for sale.' },
    { term: 'Physical Title', definition: 'The original paper document proving ownership. Required for all exports.' },
    { term: 'Lien', definition: 'A legal claim on a vehicle by a bank or lender. A title with a lien cannot be exported until paid off.' },
    { term: 'Carrier', definition: 'A transportation company or truck driver that moves cars over land.' },
    { term: 'Terminal', definition: 'A storage yard at the port where vehicles wait to be loaded onto a ship.' },
    { term: 'Gate Pass', definition: 'A document issued by the auction that allows a truck driver to pick up a specific vehicle.' },
    { term: 'QuickBooks (QBO)', definition: 'The accounting software used by MotorX to manage invoices and payments.' }
];

export const getGuideContent = (tabId) => {
    return APP_GUIDE_CONTENT[tabId] || APP_GUIDE_CONTENT.overview;
};
