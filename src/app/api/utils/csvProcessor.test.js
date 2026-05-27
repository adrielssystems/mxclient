import { describe, it, expect, afterAll } from 'vitest';
import { processRobustCSV } from './csvProcessor';
import sql from './sql';

describe('CSV Processor 11-Column Support', () => {
    const testVin = 'TESTVIN' + Math.floor(Math.random() * 1000000000);
    
    afterAll(async () => {
        await sql`DELETE FROM vehicles WHERE vin = ${testVin} OR vin LIKE 'TESTVIN%'`;
    });

    it('should correctly process an 11-column CSV with DL, Buyer, and PIN#', async () => {
        // Find a valid client in the DB to avoid quarantine issues if possible
        const clients = await sql`SELECT name FROM auth_users WHERE role IN ('client', 'main_client') LIMIT 1`;
        const clientName = clients.length > 0 ? clients[0].name : "HECTOR";

        const csv = `Date,Auction,Locations,LOT,Vehicle,VIN#,Name,Price,DL,Buyer,PIN#
03/27/2026,COPART,Miami,12345678,Toyota Camry,${testVin},${clientName},15000,DL-99,B-88,P-77`;

        const results = await processRobustCSV(csv, { userId: 'TEST_USER', createMissingLocations: true });
        
        expect(results.success_count).toBe(1);
        
        const saved = await sql`SELECT dealer, buyer_number, pin_number FROM vehicles WHERE vin = ${testVin}`;
        expect(saved[0].dealer).toBe('DL-99');
        expect(saved[0].buyer_number).toBe('B-88');
        expect(saved[0].pin_number).toBe('P-77');
    });

    it('should fall back to "Date" if "Date Purchase" is missing', async () => {
        const vin2 = testVin + '2';
        const csv = `Date,Auction,Locations,LOT,Vehicle,VIN#,Name,Price
03/27/2026,COPART,Miami,87654321,Honda Accord,${vin2},SYSTEM,12000`;

        const results = await processRobustCSV(csv, { userId: 'TEST_USER', createMissingLocations: true });
        expect(results.success_count).toBe(1);
        
        const saved = await sql`SELECT purchase_date FROM vehicles WHERE vin = ${vin2}`;
        expect(saved[0].purchase_date).not.toBeNull();
    });
});
