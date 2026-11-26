-- OPTIONAL manual fallback.
--
-- schema.prisma now declares `extensions = [pg_trgm]` (postgresqlExtensions
-- preview), so a normal `npx prisma db push` creates the extension and the
-- trigram GIN indexes for you. You only need this file if db push cannot
-- create the extension (e.g. restricted permissions) — run it once, then
-- `npx prisma db push`:
--   npx prisma db execute --file prisma/sql/search-indexes.sql --schema prisma/schema.prisma
CREATE EXTENSION IF NOT EXISTS pg_trgm;
