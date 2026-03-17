import { getVendors, createVendor } from "@/actions/vendors";
import { VENDOR_TYPE_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { revalidatePath } from "next/cache";

export default async function VendorsPage() {
  const vendors = await getVendors();

  async function handleCreate(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const type = formData.get("type") as string;
    if (!name || !type) return;
    await createVendor({ name, type: type as never });
    revalidatePath("/vendors");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vendors</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" required placeholder="Vendor name" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                name="type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                required
              >
                {Object.entries(VENDOR_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {VENDOR_TYPE_LABELS[vendor.type] || vendor.type}
                  </Badge>
                </TableCell>
                <TableCell>{vendor.contactInfo || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
