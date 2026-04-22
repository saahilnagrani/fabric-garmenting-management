import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/feature-flags";
import { db } from "@/lib/db";
import { getCurrentPhase, getPhases } from "@/actions/phases";
import { getAccessoryMasters } from "@/actions/accessories";
import { getAccessoryPurchases, getAccessoryPurchaseOrders, getAccessoryPurchaseOrderFiscalYears } from "@/actions/accessory-purchases";
import { getAccessoryDispatches, getAccessoryDispatchNotes, getAccessoryDispatchNoteFiscalYears } from "@/actions/accessory-dispatches";
import { currentFiscalYear } from "@/lib/po-numbering";
import { getAccessoryBalances } from "@/actions/accessory-balance";
import { getVendors } from "@/actions/vendors";
import { getProducts } from "@/actions/products";
import { getGarmentingLocations } from "@/actions/garmenting-locations";
import { AccessoryPurchaseGrid } from "@/components/accessories/accessory-purchase-grid";
import { AccessoryPurchaseOrdersGrid } from "@/components/accessories/accessory-purchase-orders-grid";
import { AccessoryDispatchNotesGrid } from "@/components/accessories/accessory-dispatch-notes-grid";
import { AccessoryDispatchGrid } from "@/components/accessories/accessory-dispatch-grid";
import { AccessoryBalanceGrid } from "@/components/accessories/accessory-balance-grid";
import { AccessoryTabBar } from "@/components/accessories/accessory-tab-bar";

type Tab = "purchases" | "dispatches" | "balance" | "purchase-orders" | "dispatch-notes";

export default async function AccessoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; phaseId?: string; fy?: string }>;
}) {
  if (!FEATURES.accessories) notFound();

  const params = await searchParams;
  const tab: Tab =
    params.tab === "dispatches" || params.tab === "balance" || params.tab === "purchase-orders" || params.tab === "dispatch-notes"
      ? params.tab
      : "purchases";

  // ── Purchases & Dispatches tabs both need the current phase ────────
  let phaseForPurchasesDispatches: { id: string; number: number; name: string } | null = null;
  if (tab === "purchases" || tab === "dispatches") {
    phaseForPurchasesDispatches = await getCurrentPhase();
    if (!phaseForPurchasesDispatches) {
      return (
        <div className="space-y-4">
          <AccessoryTabBar activeTab={tab} />
          <p className="text-muted-foreground">No active phase selected.</p>
        </div>
      );
    }
  }

  // ── Purchases tab ──────────────────────────────────────────────────
  if (tab === "purchases") {
    const phase = phaseForPurchasesDispatches!;
    const [purchases, accessories, vendors] = await Promise.all([
      getAccessoryPurchases(phase.id),
      getAccessoryMasters(),
      getVendors(),
    ]);

    const accessoryOptions = accessories.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      category: a.category,
      unit: a.unit,
      defaultCostPerUnit: a.defaultCostPerUnit ? Number(a.defaultCostPerUnit) : null,
      vendorId: a.vendorId,
    }));

    return (
      <div className="space-y-4">
        <AccessoryTabBar activeTab={tab} />
        <p className="text-sm text-muted-foreground">
          {purchases.length} purchase{purchases.length === 1 ? "" : "s"} in Phase {phase.number} — {phase.name}
        </p>
        <AccessoryPurchaseGrid
          purchases={JSON.parse(JSON.stringify(purchases))}
          phaseId={phase.id}
          accessories={accessoryOptions}
          vendors={vendors}
        />
      </div>
    );
  }

  // ── Purchase Orders tab ────────────────────────────────────────────
  if (tab === "purchase-orders") {
    const availableFys = await getAccessoryPurchaseOrderFiscalYears();
    const defaultFy = currentFiscalYear();
    const selectedFy = params.fy ?? defaultFy;
    const fyFilter = selectedFy === "ALL" ? undefined : selectedFy;
    const orders = await getAccessoryPurchaseOrders(fyFilter);

    // Ensure the current FY and the selected FY always appear in the dropdown,
    // even if no POs exist for them yet.
    const fySet = new Set<string>(availableFys);
    fySet.add(defaultFy);
    if (fyFilter) fySet.add(fyFilter);
    const fiscalYears = [...fySet].sort((a, b) => b.localeCompare(a));

    return (
      <div className="space-y-4">
        <AccessoryTabBar activeTab={tab} />
        <p className="text-sm text-muted-foreground">
          {orders.length} purchase order{orders.length === 1 ? "" : "s"}{" "}
          {fyFilter ? `for FY ${fyFilter}` : "across all years"}.
        </p>
        <AccessoryPurchaseOrdersGrid
          orders={JSON.parse(JSON.stringify(orders))}
          fiscalYears={fiscalYears}
          selectedFiscalYear={selectedFy}
        />
      </div>
    );
  }

  // ── Dispatches tab ─────────────────────────────────────────────────
  if (tab === "dispatches") {
    const phase = phaseForPurchasesDispatches!;
    const [dispatches, accessories, products, garmenterLocations, vendors] = await Promise.all([
      getAccessoryDispatches(phase.id),
      getAccessoryMasters(),
      getProducts(phase.id),
      getGarmentingLocations(),
      getVendors(),
    ]);

    const accessoryOptions = accessories.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      category: a.category,
      unit: a.unit,
    }));

    const garmenterSet = new Set<string>();
    for (const g of garmenterLocations) garmenterSet.add(g.name);
    for (const v of vendors) {
      if (v.type === "GARMENTING") garmenterSet.add(v.name);
    }
    const garmenters = Array.from(garmenterSet).sort();

    const productOptions = products.map((p) => ({
      id: p.id,
      label: `${p.articleNumber || p.styleNumber} / ${p.colourOrdered}${
        p.productName ? ` — ${p.productName}` : ""
      }`,
    }));

    const allMastersWithBom = await db.productMaster.findMany({
      where: { isStrikedThrough: false },
      select: {
        id: true,
        skuCode: true,
        styleNumber: true,
        articleNumber: true,
        accessoryLinks: { select: { accessoryId: true } },
      },
    });
    const masterBySkuCode = new Map<string, { id: string; accessoryIds: Set<string> }>();
    const masterByStyleArticle = new Map<string, { id: string; accessoryIds: Set<string> }>();
    for (const m of allMastersWithBom) {
      const accessoryIds = new Set(m.accessoryLinks.map((l) => l.accessoryId));
      const info = { id: m.id, accessoryIds };
      if (m.skuCode) masterBySkuCode.set(m.skuCode, info);
      masterByStyleArticle.set(`${m.styleNumber}::${m.articleNumber || ""}`, info);
    }
    const productsByAccessory: Record<string, string[]> = {};
    for (const p of products) {
      const master =
        (p.skuCode ? masterBySkuCode.get(p.skuCode) : undefined) ||
        masterByStyleArticle.get(`${p.styleNumber}::${p.articleNumber || ""}`);
      if (!master) continue;
      for (const accessoryId of master.accessoryIds) {
        if (!productsByAccessory[accessoryId]) productsByAccessory[accessoryId] = [];
        productsByAccessory[accessoryId].push(p.id);
      }
    }

    return (
      <div className="space-y-4">
        <AccessoryTabBar activeTab={tab} />
        <p className="text-sm text-muted-foreground">
          {dispatches.length} dispatch{dispatches.length === 1 ? "" : "es"} in Phase {phase.number} — {phase.name}
        </p>
        <AccessoryDispatchGrid
          dispatches={JSON.parse(JSON.stringify(dispatches))}
          phaseId={phase.id}
          accessories={accessoryOptions}
          garmenters={garmenters}
          products={productOptions}
          productsByAccessory={productsByAccessory}
        />
      </div>
    );
  }

  // ── Dispatch Notes tab ─────────────────────────────────────────────
  if (tab === "dispatch-notes") {
    const availableFys = await getAccessoryDispatchNoteFiscalYears();
    const defaultFy = currentFiscalYear();
    const selectedFy = params.fy ?? defaultFy;
    const fyFilter = selectedFy === "ALL" ? undefined : selectedFy;
    const notes = await getAccessoryDispatchNotes(fyFilter);

    const fySet = new Set<string>(availableFys);
    fySet.add(defaultFy);
    if (fyFilter) fySet.add(fyFilter);
    const fiscalYears = [...fySet].sort((a, b) => b.localeCompare(a));

    return (
      <div className="space-y-4">
        <AccessoryTabBar activeTab={tab} />
        <p className="text-sm text-muted-foreground">
          {notes.length} dispatch note{notes.length === 1 ? "" : "s"}{" "}
          {fyFilter ? `for FY ${fyFilter}` : "across all years"}.
        </p>
        <AccessoryDispatchNotesGrid
          notes={JSON.parse(JSON.stringify(notes))}
          fiscalYears={fiscalYears}
          selectedFiscalYear={selectedFy}
        />
      </div>
    );
  }

  // ── Balance tab ────────────────────────────────────────────────────
  const allPhases = await getPhases();
  let phaseId = params.phaseId;
  if (!phaseId) {
    const current = await getCurrentPhase();
    phaseId = current?.id || allPhases[0]?.id;
  }
  if (!phaseId) {
    return (
      <div className="space-y-4">
        <AccessoryTabBar activeTab={tab} />
        <p className="text-muted-foreground">No phases configured.</p>
      </div>
    );
  }

  const rows = await getAccessoryBalances(phaseId);
  const selectedPhase = allPhases.find((p) => p.id === phaseId);

  return (
    <div className="space-y-4">
      <AccessoryTabBar activeTab={tab} />
      <p className="text-sm text-muted-foreground">
        Opening / purchased / dispatched / closing per accessory
        {selectedPhase ? ` for Phase ${selectedPhase.number} — ${selectedPhase.name}` : ""}.
        Closing balance carries into the next phase&apos;s opening.
      </p>
      <AccessoryBalanceGrid
        rows={rows}
        phases={allPhases.map((p) => ({ id: p.id, name: p.name, number: p.number }))}
        selectedPhaseId={phaseId}
      />
    </div>
  );
}
