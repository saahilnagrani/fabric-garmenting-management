# Prompts Directory

This directory contains all system prompts, context templates, and email templates for the China Sourcing Agent Platform.

## Structure

```
prompts/
├── README.md                          # This file
├── discovery-agent/
│   ├── system.txt                     # System prompt for supplier discovery
│   └── context-template.txt           # Dynamic context template (Handlebars-style)
├── email-agent/
│   ├── system.txt                     # System prompt for email generation
│   ├── context-template.txt           # Dynamic context template
│   └── templates/
│       ├── initial-contact.txt        # Structure guide for first outreach
│       ├── follow-up.txt              # Structure guide for follow-up emails
│       ├── sample-request.txt         # Structure guide for sample requests
│       └── negotiation.txt            # Structure guide for pricing negotiation
├── scoring-agent/
│   ├── system.txt                     # System prompt for supplier scoring
│   └── context-template.txt           # Dynamic context template
└── reply-agent/
    ├── system.txt                     # System prompt for reply analysis
    └── context-template.txt           # Dynamic context template
```

## How These Are Used

### System Prompts (system.txt)
Passed as the `system` parameter in the Claude API call. These are static and define the agent's identity, rules, and output format. They change rarely and should be version controlled.

### Context Templates (context-template.txt)
Populated at runtime by the Context Assembler function on the server side. Uses Handlebars-style `{{variable}}` placeholders that get replaced with live data from the database. The assembled context is passed as the `user` message content.

### Email Templates (templates/*.txt)
These are NOT sent to Claude directly. They are loaded by the Email Agent's Context Assembler and included as part of the user message to give Claude structural guidance for each email type. The email agent's system prompt handles the overall behavior; these templates provide type-specific structure.

## Template Variable Reference

### Company Profile Variables
- `{{company_name}}` - Company name
- `{{company_description}}` - Full company description
- `{{company_location}}` - City, Country
- `{{company_website}}` - Website URL
- `{{product_categories}}` - What the company manufactures
- `{{annual_volume_estimate}}` - Approximate annual material purchase volume
- `{{target_markets}}` - Where products are sold
- `{{certifications_needed}}` - Required supplier certifications
- `{{key_selling_points}}` - Why suppliers should work with this company
- `{{tagline}}` - One-line company description

### Supplier Variables (prefixed with supplier.)
- `{{supplier.company_name}}` - Supplier company name (English)
- `{{supplier.company_name_cn}}` - Supplier company name (Chinese)
- `{{supplier.source_platform}}` - Where the supplier was found
- `{{supplier.source_url}}` - Profile URL
- `{{supplier.location_city}}` / `{{supplier.location_province}}`
- `{{supplier.primary_materials}}` - Materials they supply
- `{{supplier.certifications}}` - Certifications they hold
- `{{supplier.moq_range}}` - Stated MOQ
- `{{supplier.year_established}}`
- `{{supplier.employee_count}}`
- `{{supplier.exports_to_india}}`
- `{{supplier.contact_person}}` / `{{supplier.contact_email}}` / `{{supplier.contact_wechat}}`
- `{{supplier.pipeline_status}}`
- `{{supplier.priority_score}}`
- `{{supplier.ai_summary}}`
- `{{supplier.red_flags}}`

### Material Variables (in {{#each materials}} loops)
- `{{name}}` - Material name
- `{{category}}` - Category (fabric, trim, zipper, etc.)
- `{{specifications}}` - Detailed specs (GSM, width, composition)
- `{{target_price_range}}` - Target price per unit
- `{{priority}}` - high / medium / low
- `{{notes}}` - Usage context

### Outreach Variables
- `{{email_type}}` - initial_contact / follow_up_1 / sample_request / negotiation
- `{{tone}}` - formal / friendly_professional / direct
- `{{bilingual}}` - true / false
- `{{days_since_last_contact}}` - Days since last email to this supplier
- `{{previous_outreach}}` - Array of prior outreach records

## Updating Prompts

1. Edit the relevant .txt file in this directory.
2. Test the updated prompt using the /playground page in the app.
3. Run it against the standard test cases for that agent.
4. Commit the change with a clear message describing what changed and why.
5. The app reads prompts from disk at runtime, so changes take effect immediately (no rebuild needed).

## Adding a New Agent

1. Create a new directory: `prompts/{agent-name}/`
2. Add `system.txt` with the agent's system prompt.
3. Add `context-template.txt` with the dynamic context structure.
4. Register the agent in the agent registry (see app code).
5. Build the Context Assembler function for this agent.
6. Add the agent to the /playground page for testing.
