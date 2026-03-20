import { getVendors } from "@/actions/vendors";
import { VendorList } from "@/components/vendors/vendor-list";

export default async function VendorsPage() {
  const vendors = await getVendors();

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Vendors</h1>
      <p className="text-sm text-muted-foreground">
        {vendors.length} vendors
      </p>
      <VendorList vendors={JSON.parse(JSON.stringify(vendors))} />
    </div>
  );
}
