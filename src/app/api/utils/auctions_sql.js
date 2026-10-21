import postgres from 'postgres';

const auctionsSql = postgres(process.env.AUCTIONS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/motorx_auctions_db?sslmode=disable', {
  ssl: process.env.AUCTIONS_DATABASE_URL?.includes('sslmode=disable') ? false : (process.env.AUCTIONS_DATABASE_URL?.includes('localhost') ? false : 'require'),
});

export default auctionsSql;
