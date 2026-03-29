import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { ulid } from "ulid";
import { notifications, users } from "./db/schema";

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export async function createNotification(d1: D1Database, input: NotificationInput) {
  const db = drizzle(d1);
  await db.insert(notifications).values({
    id: ulid(),
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}

export async function notifyAdmins(
  d1: D1Database,
  input: Omit<NotificationInput, "userId">
) {
  const db = drizzle(d1);
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).all();
  await Promise.all(admins.map((admin) => createNotification(d1, { ...input, userId: admin.id })));
}

export async function listNotificationsForUser(d1: D1Database, userId: string, limit = 12) {
  const db = drizzle(d1);
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();
}

export async function countUnreadNotifications(d1: D1Database, userId: string) {
  const db = drizzle(d1);
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .get();
  return row?.count ?? 0;
}

export async function markNotificationRead(d1: D1Database, userId: string, notificationId: string) {
  const db = drizzle(d1);
  await db
    .update(notifications)
    .set({ isRead: true, readAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(d1: D1Database, userId: string) {
  const db = drizzle(d1);
  await db
    .update(notifications)
    .set({ isRead: true, readAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}
