-- ============================================================
-- Sourcing Agent - Database Migration (Neon / Postgres)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Enum Types
-- ============================================================

CREATE TYPE source_platform AS ENUM (
  'alibaba',
  'made_in_china',
  'global_sources',
  'direct',
  'referral'
);

CREATE TYPE pipeline_status AS ENUM (
  'identified',
  'researching',
  'contacted',
  'responded',
  'sampling',
  'approved',
  'rejected',
  'on_hold'
);

CREATE TYPE email_type AS ENUM (
  'initial',
  'follow_up_1',
  'follow_up_2',
  'sample_request',
  'negotiation'
);

CREATE TYPE outreach_language AS ENUM ('en', 'zh');

CREATE TYPE outreach_tone AS ENUM (
  'formal',
  'friendly_professional',
  'direct'
);

CREATE TYPE outreach_status AS ENUM (
  'draft',
  'approved',
  'sent',
  'replied',
  'bounced'
);

CREATE TYPE material_category AS ENUM (
  'fabric',
  'trim',
  'zipper',
  'elastic',
  'label',
  'packaging',
  'thread',
  'other'
);

CREATE TYPE material_priority AS ENUM ('high', 'medium', 'low');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  company_name_cn TEXT,
  source_platform source_platform NOT NULL,
  source_url TEXT,
  location_city TEXT NOT NULL,
  location_province TEXT NOT NULL,
  primary_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  moq_range TEXT,
  estimated_annual_revenue TEXT,
  employee_count TEXT,
  year_established INTEGER,
  exports_to_india BOOLEAN,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_wechat TEXT,
  pipeline_status pipeline_status NOT NULL DEFAULT 'identified',
  priority_score INTEGER CHECK (priority_score >= 1 AND priority_score <= 10),
  notes TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outreach (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  email_type email_type NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  language outreach_language NOT NULL DEFAULT 'en',
  tone outreach_tone NOT NULL DEFAULT 'formal',
  status outreach_status NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  reply_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category material_category NOT NULL,
  name TEXT NOT NULL,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_price_range TEXT,
  priority material_priority NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  location TEXT,
  website TEXT,
  product_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  annual_volume_estimate TEXT,
  target_markets JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications_needed JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_selling_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce single row in company_profile
CREATE UNIQUE INDEX company_profile_single_row ON company_profile ((true));

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_suppliers_pipeline_status ON suppliers (pipeline_status);
CREATE INDEX idx_suppliers_priority_score ON suppliers (priority_score);
CREATE INDEX idx_materials_category ON materials (category);
CREATE INDEX idx_outreach_supplier_id ON outreach (supplier_id);
CREATE INDEX idx_outreach_status ON outreach (status);

-- ============================================================
-- Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_outreach_updated_at
  BEFORE UPDATE ON outreach
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_company_profile_updated_at
  BEFORE UPDATE ON company_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Discovery Jobs
-- ============================================================

CREATE TYPE discovery_job_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_ids JSONB NOT NULL,
  status discovery_job_status NOT NULL DEFAULT 'pending',
  results JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_jobs_status ON discovery_jobs (status);
