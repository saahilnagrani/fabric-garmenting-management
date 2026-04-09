import { getParsedSchema, listServerActions } from "@/actions/admin-docs";
import { PRODUCT_STATUS_SEQUENCE } from "@/lib/state-machine";
import { PRODUCT_STATUS_LABELS, FABRIC_ORDER_STATUS_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Workflow, Layers, Zap } from "lucide-react";

const FABRIC_ORDER_SEQUENCE = [
  "DRAFT_ORDER",
  "DISCUSSED_WITH_VENDOR",
  "ORDERED",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "RECEIVED",
];

export default async function AdminDocsPage() {
  const [schema, actions] = await Promise.all([
    getParsedSchema(),
    listServerActions(),
  ]);

  const totalModels = schema.models.length;
  const totalEnums = schema.enums.length;
  const totalActionExports = actions.reduce((sum, a) => sum + a.exports.length, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground">
          Auto-generated reference for developers and admins.
        </p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <a href="#architecture" className="group">
          <Card className="hover:border-blue-300 transition-colors">
            <CardContent className="p-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Architecture</span>
            </CardContent>
          </Card>
        </a>
        <a href="#schema" className="group">
          <Card className="hover:border-blue-300 transition-colors">
            <CardContent className="p-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Schema ({totalModels})</span>
            </CardContent>
          </Card>
        </a>
        <a href="#state-machine" className="group">
          <Card className="hover:border-blue-300 transition-colors">
            <CardContent className="p-3 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">State Machine</span>
            </CardContent>
          </Card>
        </a>
        <a href="#actions" className="group">
          <Card className="hover:border-blue-300 transition-colors">
            <CardContent className="p-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Actions ({totalActionExports})</span>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Architecture */}
      <section id="architecture" className="scroll-mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Architecture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold mb-1">Tech stack</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2">
                <li>Next.js 16 (App Router) with React Server Components</li>
                <li>PostgreSQL via Prisma ORM (generated client in <code className="text-xs bg-muted px-1 rounded">src/generated/prisma</code>)</li>
                <li>AG Grid Community for all data tables</li>
                <li>Tailwind CSS + shadcn/ui for styling and primitives</li>
                <li>Sonner for toast notifications</li>
                <li>NextAuth for authentication</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Code layout</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2">
                <li><code className="text-xs bg-muted px-1 rounded">src/app/(app)</code>: main inventory app routes (protected by session middleware)</li>
                <li><code className="text-xs bg-muted px-1 rounded">src/app/(admin)</code>: admin-only routes (extra role check)</li>
                <li><code className="text-xs bg-muted px-1 rounded">src/actions</code>: server actions organized by domain</li>
                <li><code className="text-xs bg-muted px-1 rounded">src/components</code>: React components, one folder per feature</li>
                <li><code className="text-xs bg-muted px-1 rounded">src/lib</code>: shared helpers (db client, auth, state machine, auto transitions)</li>
                <li><code className="text-xs bg-muted px-1 rounded">prisma/schema.prisma</code>: single source of truth for database</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Data flow for a typical edit</h3>
              <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 ml-2">
                <li>User edits a field in an AG Grid row or opens a sheet form</li>
                <li>Sheet calls a server action (e.g. <code className="text-xs bg-muted px-1 rounded">updateProduct</code>)</li>
                <li>Server action validates permissions via <code className="text-xs bg-muted px-1 rounded">requirePermission</code></li>
                <li>State machine validates transitions if status is changing</li>
                <li>Prisma writes the update</li>
                <li>Post-write hooks run: audit log, link sync, auto-advance, expense sync</li>
                <li>Server action returns rich result (linkedCount, autoAdvanced, etc.)</li>
                <li>Sheet shows success toast and any follow-up toasts (auto-advance list)</li>
                <li><code className="text-xs bg-muted px-1 rounded">router.refresh()</code> refetches server data and rerenders</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Key invariants</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2">
                <li>ProductFabricOrder join rows are bidirectionally synced. Editing either side triggers rebuild.</li>
                <li>Product status only moves forward (state machine enforces this).</li>
                <li>Repeat articles cannot enter SAMPLING state.</li>
                <li>Auto-advance never regresses. Manual admin bulk action is the only escape hatch.</li>
                <li>Cutting report values sync from Product back to ProductMaster on save.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Schema */}
      <section id="schema" className="scroll-mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Database Schema
              <span className="text-sm font-normal text-muted-foreground">
                ({totalModels} models, {totalEnums} enums)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-sm mb-2">Enums</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {schema.enums.map((e) => (
                  <div key={e.name} className="border rounded p-2">
                    <div className="font-mono text-xs font-semibold text-blue-700 mb-1">
                      {e.name}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {e.values.map((v) => (
                        <span
                          key={v}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Models</h3>
              <div className="space-y-3">
                {schema.models.map((m) => (
                  <details key={m.name} className="border rounded" open={m.name === "Product" || m.name === "FabricOrder" || m.name === "ProductFabricOrder"}>
                    <summary className="cursor-pointer p-2 bg-muted/50 hover:bg-muted font-mono text-xs font-semibold text-blue-700 flex items-center justify-between">
                      <span>{m.name}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {m.fields.length} fields
                        {m.indexes.length > 0 ? `, ${m.indexes.length} indexes` : ""}
                      </span>
                    </summary>
                    <div className="p-2 space-y-0.5">
                      {m.fields.map((f) => (
                        <div key={f.name} className="font-mono text-[11px] flex gap-2">
                          <span className="text-blue-900 min-w-[140px]">{f.name}</span>
                          <span className="text-purple-700 min-w-[80px]">{f.type}</span>
                          <span className="text-muted-foreground truncate">{f.attributes}</span>
                        </div>
                      ))}
                      {m.indexes.length > 0 && (
                        <div className="pt-1 mt-1 border-t space-y-0.5">
                          {m.indexes.map((idx, i) => (
                            <div key={i} className="font-mono text-[10px] text-green-700">
                              {idx}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* State Machine */}
      <section id="state-machine" className="scroll-mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-blue-600" />
              State Machine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div>
              <h3 className="font-semibold mb-2">Article Order Status Flow</h3>
              <p className="text-muted-foreground text-xs mb-3">
                Forward only. Repeat articles skip SAMPLING automatically.
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {PRODUCT_STATUS_SEQUENCE.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <span
                      className={`text-[11px] font-mono px-2 py-1 rounded ${
                        s === "SAMPLING" ? "bg-amber-50 border border-amber-200" : "bg-blue-50 border border-blue-200"
                      }`}
                    >
                      {PRODUCT_STATUS_LABELS[s]}
                      {s === "SAMPLING" && (
                        <span className="ml-1 text-[9px] text-amber-700">(skipped for repeats)</span>
                      )}
                    </span>
                    {i < PRODUCT_STATUS_SEQUENCE.length - 1 && (
                      <span className="text-muted-foreground">&rarr;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Fabric Order Status Flow</h3>
              <div className="flex flex-wrap items-center gap-1">
                {FABRIC_ORDER_SEQUENCE.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <span className="text-[11px] font-mono px-2 py-1 rounded bg-green-50 border border-green-200">
                      {FABRIC_ORDER_STATUS_LABELS[s]}
                    </span>
                    {i < FABRIC_ORDER_SEQUENCE.length - 1 && (
                      <span className="text-muted-foreground">&rarr;</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Auto-Transition Rules</h3>
              <table className="w-full text-xs border rounded overflow-hidden">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2 font-medium">Trigger</th>
                    <th className="text-left p-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-2">Any linked fabric order reaches ORDERED or later</td>
                    <td className="p-2">Product advances to FABRIC_ORDERED</td>
                  </tr>
                  <tr>
                    <td className="p-2">ALL linked fabric orders reach RECEIVED</td>
                    <td className="p-2">Product advances to FABRIC_RECEIVED</td>
                  </tr>
                  <tr>
                    <td className="p-2">cuttingReportGarmentsPerKg or _2 is set on a product</td>
                    <td className="p-2">Product advances to CUTTING_REPORT</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground mt-2">
                Auto-transitions only move products forward. A product already at a later stage is never pulled back.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Validation Rules (manual edits)</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2 text-xs">
                <li>Cannot regress status through the edit sheet. Use admin bulk action.</li>
                <li>Repeat articles cannot be set to SAMPLING.</li>
                <li>Fabric orders with linked products trigger auto-advance when their status changes.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Server Actions */}
      <section id="actions" className="scroll-mt-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Server Actions
              <span className="text-sm font-normal text-muted-foreground">
                ({actions.length} files, {totalActionExports} exports)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actions.map((a) => (
                <details key={a.file} className="border rounded">
                  <summary className="cursor-pointer p-2 bg-muted/50 hover:bg-muted text-xs font-mono flex items-center justify-between">
                    <span className="text-blue-700 font-semibold">{a.file}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {a.exports.length} exports
                    </span>
                  </summary>
                  <div className="p-2 grid grid-cols-2 md:grid-cols-3 gap-1">
                    {a.exports.map((exp) => (
                      <code
                        key={exp}
                        className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate"
                      >
                        {exp}
                      </code>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
