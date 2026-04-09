"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PlusIcon, XIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CompanyProfile } from "@/types/sourcing";

type FormData = {
  company_name: string;
  tagline: string;
  description: string;
  location: string;
  website: string;
  product_categories: string;
  annual_volume_estimate: string;
  target_markets: string;
  certifications_needed: string;
  key_selling_points: string[];
};

const emptyForm: FormData = {
  company_name: "",
  tagline: "",
  description: "",
  location: "",
  website: "",
  product_categories: "",
  annual_volume_estimate: "",
  target_markets: "",
  certifications_needed: "",
  key_selling_points: [],
};

function profileToForm(profile: CompanyProfile): FormData {
  return {
    company_name: profile.company_name ?? "",
    tagline: profile.tagline ?? "",
    description: profile.description ?? "",
    location: profile.location ?? "",
    website: profile.website ?? "",
    product_categories: (profile.product_categories ?? []).join(", "),
    annual_volume_estimate: profile.annual_volume_estimate ?? "",
    target_markets: (profile.target_markets ?? []).join(", "),
    certifications_needed: (profile.certifications_needed ?? []).join(", "),
    key_selling_points: profile.key_selling_points ?? [],
  };
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSellingPoint, setNewSellingPoint] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/sourcing/company-profile");
      if (res.ok) {
        const profile: CompanyProfile = await res.json();
        if (profile) {
          setForm(profileToForm(profile));
        }
      }
    } catch {
      toast.error("Failed to load company profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name.trim(),
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        website: form.website.trim() || null,
        product_categories: parseCommaSeparated(form.product_categories),
        annual_volume_estimate: form.annual_volume_estimate.trim() || null,
        target_markets: parseCommaSeparated(form.target_markets),
        certifications_needed: parseCommaSeparated(form.certifications_needed),
        key_selling_points: form.key_selling_points.filter(Boolean),
      };

      const res = await fetch("/api/sourcing/company-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      const updated: CompanyProfile = await res.json();
      setForm(profileToForm(updated));
      toast.success("Company profile saved successfully");
    } catch {
      toast.error("Failed to save company profile");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addSellingPoint = () => {
    const trimmed = newSellingPoint.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      key_selling_points: [...prev.key_selling_points, trimmed],
    }));
    setNewSellingPoint("");
  };

  const removeSellingPoint = (index: number) => {
    setForm((prev) => ({
      ...prev,
      key_selling_points: prev.key_selling_points.filter((_, i) => i !== index),
    }));
  };

  const categories = parseCommaSeparated(form.product_categories);
  const markets = parseCommaSeparated(form.target_markets);
  const certs = parseCommaSeparated(form.certifications_needed);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Profile Settings</h1>
        <p className="text-muted-foreground">
          Configure your company information used for supplier outreach.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Core details about your company.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">
                  Company Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder="Your company name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => updateField("tagline", e.target.value)}
                  placeholder="A short tagline describing your brand"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe your company, what you produce, your values..."
                  rows={4}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(e) => updateField("location", e.target.value)}
                    placeholder="e.g. Mumbai, India"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Details</CardTitle>
              <CardDescription>
                Information about your sourcing needs and scale.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product_categories">
                  Product Categories
                </Label>
                <Input
                  id="product_categories"
                  value={form.product_categories}
                  onChange={(e) =>
                    updateField("product_categories", e.target.value)
                  }
                  placeholder="Activewear, Loungewear, Athleisure (comma-separated)"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple categories with commas.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="annual_volume_estimate">
                  Annual Volume Estimate
                </Label>
                <Input
                  id="annual_volume_estimate"
                  value={form.annual_volume_estimate}
                  onChange={(e) =>
                    updateField("annual_volume_estimate", e.target.value)
                  }
                  placeholder="e.g. 50,000 - 100,000 units"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_markets">Target Markets</Label>
                <Input
                  id="target_markets"
                  value={form.target_markets}
                  onChange={(e) => updateField("target_markets", e.target.value)}
                  placeholder="India, Southeast Asia, Middle East (comma-separated)"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple markets with commas.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="certifications_needed">
                  Certifications Needed
                </Label>
                <Input
                  id="certifications_needed"
                  value={form.certifications_needed}
                  onChange={(e) =>
                    updateField("certifications_needed", e.target.value)
                  }
                  placeholder="OEKO-TEX, GOTS, BCI (comma-separated)"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple certifications with commas.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Selling Points</CardTitle>
              <CardDescription>
                Highlight what makes your company stand out to suppliers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newSellingPoint}
                  onChange={(e) => setNewSellingPoint(e.target.value)}
                  placeholder="Add a selling point..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSellingPoint();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addSellingPoint}
                >
                  <PlusIcon className="size-4" />
                  Add
                </Button>
              </div>

              {form.key_selling_points.length > 0 ? (
                <ul className="space-y-2">
                  {form.key_selling_points.map((point, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span>{point}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeSellingPoint(i)}
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No selling points added yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Button type="submit" disabled={saving} size="lg">
            <SaveIcon className="size-4" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </form>

        {/* Preview Column */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Profile Preview</CardTitle>
              <CardDescription>
                How your profile appears to the outreach system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.company_name ? (
                <>
                  <div>
                    <h2 className="text-xl font-bold">
                      {form.company_name}
                    </h2>
                    {form.tagline && (
                      <p className="italic text-muted-foreground">
                        {form.tagline}
                      </p>
                    )}
                  </div>

                  {form.description && (
                    <p className="text-sm leading-relaxed">
                      {form.description}
                    </p>
                  )}

                  {(form.location || form.website) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {form.location && <span>{form.location}</span>}
                      {form.website && <span>{form.website}</span>}
                    </div>
                  )}

                  {form.annual_volume_estimate && (
                    <p className="text-sm">
                      <span className="font-medium">Annual Volume:</span>{" "}
                      {form.annual_volume_estimate}
                    </p>
                  )}

                  <Separator />

                  {categories.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-sm font-medium">
                        Product Categories
                      </h3>
                      <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                        {categories.map((cat, i) => (
                          <li key={i}>{cat}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {markets.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-sm font-medium">
                        Target Markets
                      </h3>
                      <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                        {markets.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {certs.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-sm font-medium">
                        Certifications Needed
                      </h3>
                      <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                        {certs.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {form.key_selling_points.length > 0 && (
                    <div>
                      <h3 className="mb-1 text-sm font-medium">
                        Key Selling Points
                      </h3>
                      <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
                        {form.key_selling_points.map((sp, i) => (
                          <li key={i}>{sp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Enter a company name to see the preview.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
