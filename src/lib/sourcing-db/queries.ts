import { eq, desc, ilike, or, inArray } from 'drizzle-orm';
import { db } from '@/lib/sourcing-db';
import {
  suppliers,
  materials,
  outreach,
  companyProfile,
  discoveryJobs,
} from '@/lib/sourcing-db/schema';
import type {
  PipelineStatus,
  MaterialCategory,
} from '@/types/sourcing';

// ============================================================
// Suppliers
// ============================================================

export async function getSuppliers(filters?: {
  pipeline_status?: PipelineStatus;
  search?: string;
}) {
  const conditions = [];

  if (filters?.pipeline_status) {
    conditions.push(eq(suppliers.pipeline_status, filters.pipeline_status));
  }

  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(suppliers.company_name, pattern),
        ilike(suppliers.company_name_cn, pattern),
        ilike(suppliers.location_city, pattern),
        ilike(suppliers.location_province, pattern),
      )!,
    );
  }

  const query = db
    .select()
    .from(suppliers)
    .orderBy(desc(suppliers.created_at));

  if (conditions.length === 0) {
    return query;
  }

  if (conditions.length === 1) {
    return query.where(conditions[0]);
  }

  // If we have both status and search, combine with AND (implicit from multiple where calls not supported,
  // so we use the `and` helper)
  const { and } = await import('drizzle-orm');
  return query.where(and(...conditions));
}

export async function getSupplier(id: string) {
  const results = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1);

  return results[0] ?? null;
}

export async function createSupplier(
  supplier: typeof suppliers.$inferInsert,
) {
  const results = await db
    .insert(suppliers)
    .values(supplier)
    .returning();

  return results[0];
}

export async function updateSupplier(
  id: string,
  updates: Partial<typeof suppliers.$inferInsert>,
) {
  const results = await db
    .update(suppliers)
    .set({ ...updates, updated_at: new Date() })
    .where(eq(suppliers.id, id))
    .returning();

  return results[0];
}

export async function deleteSupplier(id: string): Promise<void> {
  await db.delete(suppliers).where(eq(suppliers.id, id));
}

export async function updateSupplierStatus(
  id: string,
  status: PipelineStatus,
) {
  return updateSupplier(id, { pipeline_status: status });
}

// ============================================================
// Materials
// ============================================================

export async function getMaterials(filters?: {
  category?: MaterialCategory;
}) {
  if (filters?.category) {
    return db
      .select()
      .from(materials)
      .where(eq(materials.category, filters.category))
      .orderBy(desc(materials.created_at));
  }

  return db
    .select()
    .from(materials)
    .orderBy(desc(materials.created_at));
}

export async function getMaterial(id: string) {
  const results = await db
    .select()
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);

  return results[0] ?? null;
}

export async function createMaterial(
  material: typeof materials.$inferInsert,
) {
  const results = await db
    .insert(materials)
    .values(material)
    .returning();

  return results[0];
}

export async function updateMaterial(
  id: string,
  updates: Partial<typeof materials.$inferInsert>,
) {
  const results = await db
    .update(materials)
    .set({ ...updates, updated_at: new Date() })
    .where(eq(materials.id, id))
    .returning();

  return results[0];
}

export async function deleteMaterial(id: string): Promise<void> {
  await db.delete(materials).where(eq(materials.id, id));
}

// ============================================================
// Outreach
// ============================================================

export async function getOutreachBySupplier(supplierId: string) {
  return db
    .select()
    .from(outreach)
    .where(eq(outreach.supplier_id, supplierId))
    .orderBy(desc(outreach.created_at));
}

export async function createOutreach(
  outreachData: typeof outreach.$inferInsert,
) {
  const results = await db
    .insert(outreach)
    .values(outreachData)
    .returning();

  return results[0];
}

export async function updateOutreach(
  id: string,
  updates: Partial<typeof outreach.$inferInsert>,
) {
  const results = await db
    .update(outreach)
    .set({ ...updates, updated_at: new Date() })
    .where(eq(outreach.id, id))
    .returning();

  return results[0];
}

// ============================================================
// Company Profile
// ============================================================

export async function getCompanyProfile() {
  const results = await db
    .select()
    .from(companyProfile)
    .limit(1);

  return results[0] ?? null;
}

export async function upsertCompanyProfile(
  profile: Partial<typeof companyProfile.$inferInsert> & { company_name?: string },
) {
  const existing = await getCompanyProfile();

  if (existing) {
    const results = await db
      .update(companyProfile)
      .set({ ...profile, updated_at: new Date() })
      .where(eq(companyProfile.id, existing.id))
      .returning();

    return results[0];
  }

  const results = await db
    .insert(companyProfile)
    .values(profile as typeof companyProfile.$inferInsert)
    .returning();

  return results[0];
}

// ============================================================
// Aliases for API route compatibility
// ============================================================

export const getSupplierById = getSupplier;
export const getMaterialById = getMaterial;

export async function getOutreachMessages(filters?: {
  supplier_id?: string;
}) {
  if (filters?.supplier_id) {
    return getOutreachBySupplier(filters.supplier_id);
  }

  return db
    .select()
    .from(outreach)
    .orderBy(desc(outreach.created_at));
}

// ============================================================
// Helpers used by agent routes
// ============================================================

export async function getSuppliersByIds(ids: string[]) {
  return db
    .select()
    .from(suppliers)
    .where(inArray(suppliers.id, ids));
}

export async function getMaterialsByIds(ids: string[]) {
  return db
    .select()
    .from(materials)
    .where(inArray(materials.id, ids));
}

export async function getAllMaterials() {
  return db.select().from(materials);
}

export async function getFirstCompanyProfile() {
  return getCompanyProfile();
}

export async function getOutreachBySupplierAsc(supplierId: string) {
  const { asc } = await import('drizzle-orm');
  return db
    .select()
    .from(outreach)
    .where(eq(outreach.supplier_id, supplierId))
    .orderBy(asc(outreach.created_at));
}

export async function getDraftOutreach() {
  return db
    .select({
      id: outreach.id,
      supplier_id: outreach.supplier_id,
      email_type: outreach.email_type,
      subject: outreach.subject,
      body_html: outreach.body_html,
      body_text: outreach.body_text,
      language: outreach.language,
      tone: outreach.tone,
      status: outreach.status,
      sent_at: outreach.sent_at,
      opened_at: outreach.opened_at,
      replied_at: outreach.replied_at,
      reply_summary: outreach.reply_summary,
      created_at: outreach.created_at,
      updated_at: outreach.updated_at,
      supplier_name: suppliers.company_name,
    })
    .from(outreach)
    .leftJoin(suppliers, eq(outreach.supplier_id, suppliers.id))
    .where(eq(outreach.status, 'draft'))
    .orderBy(desc(outreach.created_at));
}

export async function deleteOutreach(id: string): Promise<void> {
  await db.delete(outreach).where(eq(outreach.id, id));
}

// ============================================================
// Discovery Jobs
// ============================================================

export async function createDiscoveryJob(materialIds: string[]) {
  const [job] = await db.insert(discoveryJobs).values({ material_ids: materialIds }).returning();
  return job;
}

export async function getDiscoveryJob(id: string) {
  const [job] = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, id));
  return job ?? null;
}

export async function updateDiscoveryJob(id: string, data: Partial<{status: 'pending' | 'running' | 'completed' | 'failed'; results: unknown; error: string; started_at: Date; completed_at: Date}>) {
  const [job] = await db.update(discoveryJobs).set(data).where(eq(discoveryJobs.id, id)).returning();
  return job;
}

export async function getRecentDiscoveryJobs(limit = 10) {
  return db.select().from(discoveryJobs).orderBy(desc(discoveryJobs.created_at)).limit(limit);
}
