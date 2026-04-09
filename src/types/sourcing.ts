// ============================================================
// Enums
// ============================================================

export type SourcePlatform =
  | 'alibaba'
  | 'made_in_china'
  | 'global_sources'
  | 'direct'
  | 'referral';

export type PipelineStatus =
  | 'identified'
  | 'researching'
  | 'contacted'
  | 'responded'
  | 'sampling'
  | 'approved'
  | 'rejected'
  | 'on_hold';

export type EmailType =
  | 'initial'
  | 'follow_up_1'
  | 'follow_up_2'
  | 'sample_request'
  | 'negotiation';

export type OutreachLanguage = 'en' | 'zh';

export type OutreachTone = 'formal' | 'friendly_professional' | 'direct';

export type OutreachStatus =
  | 'draft'
  | 'approved'
  | 'sent'
  | 'replied'
  | 'bounced';

export type MaterialCategory =
  | 'fabric'
  | 'trim'
  | 'zipper'
  | 'elastic'
  | 'label'
  | 'packaging'
  | 'thread'
  | 'other';

export type MaterialPriority = 'high' | 'medium' | 'low';

// ============================================================
// Data Models
// ============================================================

export interface Supplier {
  id: string;
  company_name: string;
  company_name_cn: string | null;
  source_platform: SourcePlatform;
  source_url: string | null;
  location_city: string;
  location_province: string;
  primary_materials: string[];
  certifications: string[];
  moq_range: string | null;
  estimated_annual_revenue: string | null;
  employee_count: string | null;
  year_established: number | null;
  exports_to_india: boolean | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_wechat: string | null;
  pipeline_status: PipelineStatus;
  priority_score: number | null; // 1-10
  notes: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface Outreach {
  id: string;
  supplier_id: string;
  email_type: EmailType;
  subject: string;
  body_html: string;
  body_text: string;
  language: OutreachLanguage;
  tone: OutreachTone;
  status: OutreachStatus;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  reply_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialSpecifications {
  gsm?: number | null;
  width?: string | null;
  composition?: string | null;
  colors?: string[] | null;
  [key: string]: unknown;
}

export interface Material {
  id: string;
  category: MaterialCategory;
  name: string;
  specifications: MaterialSpecifications;
  target_price_range: string | null;
  priority: MaterialPriority;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyProfile {
  id: string;
  company_name: string;
  tagline: string | null;
  description: string | null;
  location: string | null;
  website: string | null;
  product_categories: string[];
  annual_volume_estimate: string | null;
  target_markets: string[];
  certifications_needed: string[];
  key_selling_points: string[];
  created_at: string;
  updated_at: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  system_prompt_path: string;
  tools: string[];
  permissions: string[];
}

// ============================================================
// Input types (for create/update operations)
// ============================================================

export type SupplierInsert = Omit<Supplier, 'id' | 'created_at' | 'updated_at'>;
export type SupplierUpdate = Partial<SupplierInsert>;

export type OutreachInsert = Omit<Outreach, 'id' | 'created_at' | 'updated_at'>;
export type OutreachUpdate = Partial<OutreachInsert>;

export type MaterialInsert = Omit<Material, 'id' | 'created_at' | 'updated_at'>;
export type MaterialUpdate = Partial<MaterialInsert>;

export type CompanyProfileInsert = Omit<CompanyProfile, 'id' | 'created_at' | 'updated_at'>;
export type CompanyProfileUpdate = Partial<CompanyProfileInsert>;
