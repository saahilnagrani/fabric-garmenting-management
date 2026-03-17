import { getVendors } from "@/actions/vendors";
import { VendorGrid } from "@/components/vendors/vendor-grid";

export default async function VendorsPage() {
  const vendors = await getVendors();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vendors</h1>
      <p className="text-sm text-muted-foreground">
        {vendors.length} vendors
      </p>
      <VendorGrid vendors={vendors} />
    </div>
  );
}
