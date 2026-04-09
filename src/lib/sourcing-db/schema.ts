import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

// ============================================================
// Enums
// ============================================================

export const sourcePlatformEnum = pgEnum('source_platform', [
  'alibaba',
  'made_in_china',
  'global_sources',
  'direct',
  'referral',
]);

export const pipelineStatusEnum = pgEnum('pipeline_status', [
  'identified',
  'researching',
  'contacted',
  'responded',
  'sampling',
  'approved',
  'rejected',
  'on_hold',
]);

export const emailTypeEnum = pgEnum('email_type', [
  'initial',
  'follow_up_1',
  'follow_up_2',
  'sample_request',
  'negotiation',
]);

export const outreachLanguageEnum = pgEnum('outreach_language', ['en', 'zh']);

export const outreachToneEnum = pgEnum('outreach_tone', [
  'formal',
  'friendly_professional',
  'direct',
]);

export const outreachStatusEnum = pgEnum('outreach_status', [
  'draft',
  'approved',
  'sent',
  'replied',
  'bounced',
]);

export const materialCategoryEnum = pgEnum('material_category', [
  'fabric',
  'trim',
  'zipper',
  'elastic',
  'label',
  'packaging',
  'thread',
  'other',
]);

export const materialPriorityEnum = pgEnum('material_priority', [
  'high',
  'medium',
  'low',
]);

export const discoveryJobStatusEnum = pgEnum('discovery_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

// ============================================================
// Tables
// ============================================================

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    company_name: text('company_name').notNull(),
    company_name_cn: text('company_name_cn'),
    source_platform: sourcePlatformEnum('source_platform').notNull(),
    source_url: text('source_url'),
    location_city: text('location_city').notNull(),
    location_province: text('location_province').notNull(),
    primary_materials: jsonb('primary_materials').notNull().default([]),
    certifications: jsonb('certifications').notNull().default([]),
    moq_range: text('moq_range'),
    estimated_annual_revenue: text('estimated_annual_revenue'),
    employee_count: text('employee_count'),
    year_established: integer('year_established'),
    exports_to_india: boolean('exports_to_india'),
    contact_person: text('contact_person'),
    contact_email: text('contact_email'),
    contact_phone: text('contact_phone'),
    contact_wechat: text('contact_wechat'),
    pipeline_status: pipelineStatusEnum('pipeline_status').notNull().default('identified'),
    priority_score: integer('priority_score'),
    notes: text('notes'),
    ai_summary: text('ai_summary'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_suppliers_pipeline_status').on(table.pipeline_status),
    index('idx_suppliers_priority_score').on(table.priority_score),
  ],
);

export const outreach = pgTable(
  'outreach',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplier_id: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    email_type: emailTypeEnum('email_type').notNull(),
    subject: text('subject').notNull(),
    body_html: text('body_html').notNull(),
    body_text: text('body_text').notNull(),
    language: outreachLanguageEnum('language').notNull().default('en'),
    tone: outreachToneEnum('tone').notNull().default('formal'),
    status: outreachStatusEnum('status').notNull().default('draft'),
    sent_at: timestamp('sent_at', { withTimezone: true }),
    opened_at: timestamp('opened_at', { withTimezone: true }),
    replied_at: timestamp('replied_at', { withTimezone: true }),
    reply_summary: text('reply_summary'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_outreach_supplier_id').on(table.supplier_id),
    index('idx_outreach_status').on(table.status),
  ],
);

export const materials = pgTable(
  'materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    category: materialCategoryEnum('category').notNull(),
    name: text('name').notNull(),
    specifications: jsonb('specifications').notNull().default({}),
    target_price_range: text('target_price_range'),
    priority: materialPriorityEnum('priority').notNull().default('medium'),
    notes: text('notes'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_materials_category').on(table.category),
  ],
);

export const companyProfile = pgTable(
  'company_profile',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    company_name: text('company_name').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    location: text('location'),
    website: text('website'),
    product_categories: jsonb('product_categories').notNull().default([]),
    annual_volume_estimate: text('annual_volume_estimate'),
    target_markets: jsonb('target_markets').notNull().default([]),
    certifications_needed: jsonb('certifications_needed').notNull().default([]),
    key_selling_points: jsonb('key_selling_points').notNull().default([]),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [],
);

export const discoveryJobs = pgTable(
  'discovery_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    material_ids: jsonb('material_ids').notNull(), // string[] of material IDs
    status: discoveryJobStatusEnum('status').notNull().default('pending'),
    results: jsonb('results'), // DiscoveredSupplier[] when completed
    error: text('error'), // error message if failed
    started_at: timestamp('started_at', { withTimezone: true }),
    completed_at: timestamp('completed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_discovery_jobs_status').on(table.status),
  ],
);

// ============================================================
// Type inference helpers
// ============================================================

export type Supplier = typeof suppliers.$inferSelect;
export type SupplierInsert = typeof suppliers.$inferInsert;

export type Outreach = typeof outreach.$inferSelect;
export type OutreachInsert = typeof outreach.$inferInsert;

export type Material = typeof materials.$inferSelect;
export type MaterialInsert = typeof materials.$inferInsert;

export type CompanyProfile = typeof companyProfile.$inferSelect;
export type CompanyProfileInsert = typeof companyProfile.$inferInsert;

export type DiscoveryJob = typeof discoveryJobs.$inferSelect;
export type DiscoveryJobInsert = typeof discoveryJobs.$inferInsert;
