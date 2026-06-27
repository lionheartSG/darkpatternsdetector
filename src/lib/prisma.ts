import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function withConnectionPoolSettings(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined");
  }

  if (databaseUrl.includes("connection_limit=")) {
    return databaseUrl;
  }

  // Next.js dev (Turbopack) can run multiple Node workers; each PrismaClient
  // opens its own pool. Prisma Postgres has a low server-side connection cap.
  const limit =
    process.env.PRISMA_CONNECTION_LIMIT ??
    (process.env.NODE_ENV === "production" ? "5" : "3");
  const joiner = databaseUrl.includes("?") ? "&" : "?";

  return `${databaseUrl}${joiner}connection_limit=${limit}&pool_timeout=20`;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasourceUrl: withConnectionPoolSettings(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
