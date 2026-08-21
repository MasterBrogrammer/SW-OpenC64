import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ software_id: string }>`
      select software_id from favorites
      where user_id = ${context.userId}
      order by created_at desc
    `;
    return rows.map((row) => row.software_id);
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((softwareId: string) => softwareId.trim())
  .handler(async ({ context, data: softwareId }) => {
    if (!softwareId) return { starred: false };
    const sql = await getSql();
    const existing = await sql<{ software_id: string }>`
      select software_id from favorites
      where user_id = ${context.userId} and software_id = ${softwareId}
    `;
    if (existing.length) {
      await sql`
        delete from favorites
        where user_id = ${context.userId} and software_id = ${softwareId}
      `;
      return { starred: false };
    }
    await sql`
      insert into favorites (user_id, software_id)
      values (${context.userId}, ${softwareId})
    `;
    return { starred: true };
  });
