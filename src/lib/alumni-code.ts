import { prisma } from "./prisma";

/**
 * Generates sequential unique Alumni IDs like ND-0001, ND-0002, ...
 */
export async function generateNextAlumniCode(): Promise<string> {
  const latest = await prisma.alumniProfile.findFirst({
    orderBy: { createdAt: "desc" },
    select: { alumniCode: true },
  });

  if (!latest?.alumniCode) {
    return "ND-0001";
  }

  const match = latest.alumniCode.match(/ND-(\d+)/);
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `ND-${String(nextNum).padStart(4, "0")}`;
}
