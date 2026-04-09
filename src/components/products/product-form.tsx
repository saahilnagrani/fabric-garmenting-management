"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  computeTotalGarmenting,
  computeFabricCostPerPiece,
  computeTotalLandedCost,
  computeDealerPrice,
  computeProfitMargin,
  computeTotalSizeCount,
} from "@/lib/computations";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { PRODUCT_STATUS_LABELS, GENDER_LABELS } from "@/lib/constants";
import { createProduct, updateProduct } from "@/actions/products";

type Vendor = { id: string; name: string };
type FormValues = Record<string, string | number | boolean | null>;

function ComputedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

export function ProductForm({
  vendors,
  phaseId,
  product,
}: {
  vendors: Vendor[];
  phaseId: string;
  product?: FormValues & { id: string };
}) {
  const router = useRouter();
  const isEditing = !!product;

  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: {
      styleNumber: product?.styleNumber || "",
      articleNumber: product?.articleNumber || "",
      skuCode: product?.skuCode || "",
      colourOrdered: product?.colourOrdered || "",
      type: product?.type || "",
      gender: product?.gender || "MENS",
      productName: product?.productName || "",
      isRepeat: product?.isRepeat || false,
      status: product?.status || "PLANNED",
      fabricVendorId: product?.fabricVendorId || "",
      fabricName: product?.fabricName || "",
      fabricGsm: product?.fabricGsm || "",
      fabricCostPerKg: product?.fabricCostPerKg || "",
      assumedFabricGarmentsPerKg: product?.assumedFabricGarmentsPerKg || "",
      fabric2Name: product?.fabric2Name || "",
      fabric2CostPerKg: product?.fabric2CostPerKg || "",
      assumedFabric2GarmentsPerKg: product?.assumedFabric2GarmentsPerKg || "",
      fabricOrderedQuantityKg: product?.fabricOrderedQuantityKg || "",
      fabricShippedQuantityKg: product?.fabricShippedQuantityKg || "",
      garmentNumber: product?.garmentNumber || "",
      actualStitchedXS: product?.actualStitchedXS || 0,
      actualStitchedS: product?.actualStitchedS || 0,
      actualStitchedM: product?.actualStitchedM || 0,
      actualStitchedL: product?.actualStitchedL || 0,
      actualStitchedXL: product?.actualStitchedXL || 0,
      actualStitchedXXL: product?.actualStitchedXXL || 0,
      stitchingCost: product?.stitchingCost || "",
      brandLogoCost: product?.brandLogoCost || "",
      neckTwillCost: product?.neckTwillCost || "",
      reflectorsCost: product?.reflectorsCost || "",
      fusingCost: product?.fusingCost || "",
      accessoriesCost: product?.accessoriesCost || "",
      brandTagCost: product?.brandTagCost || "",
      sizeTagCost: product?.sizeTagCost || "",
      packagingCost: product?.packagingCost || "",
      outwardShippingCost: product?.outwardShippingCost || "",
      proposedMrp: product?.proposedMrp || "",
      onlineMrp: product?.onlineMrp || "",
      garmentingAt: product?.garmentingAt || "",
      orderDate: product?.orderDate || "",
    } as FormValues,
  });

  const watched = watch();
  const totalGarmenting = computeTotalGarmenting(watched);
  const fabricCostPerPiece = computeFabricCostPerPiece(watched);
  const totalLanded = computeTotalLandedCost(watched);
  const dp = computeDealerPrice(watched.proposedMrp);
  const pm = computeProfitMargin(watched);
  const totalSizes = computeTotalSizeCount(watched);

  async function onSubmit(data: FormValues) {
    try {
      const payload = {
        phaseId,
        styleNumber: String(data.styleNumber),
        articleNumber: data.articleNumber ? String(data.articleNumber) : null,
        skuCode: data.skuCode ? String(data.skuCode) : null,
        colourOrdered: String(data.colourOrdered),
        type: String(data.type),
        gender: String(data.gender),
        productName: data.productName ? String(data.productName) : null,
        isRepeat: Boolean(data.isRepeat),
        status: String(data.status),
        fabricVendorId: String(data.fabricVendorId),
        fabricName: String(data.fabricName),
        fabricGsm: data.fabricGsm ? Number(data.fabricGsm) : null,
        fabricCostPerKg: data.fabricCostPerKg ? Number(data.fabricCostPerKg) : null,
        assumedFabricGarmentsPerKg: data.assumedFabricGarmentsPerKg ? Number(data.assumedFabricGarmentsPerKg) : null,
        fabric2Name: data.fabric2Name ? String(data.fabric2Name) : null,
        fabric2CostPerKg: data.fabric2CostPerKg ? Number(data.fabric2CostPerKg) : null,
        assumedFabric2GarmentsPerKg: data.assumedFabric2GarmentsPerKg ? Number(data.assumedFabric2GarmentsPerKg) : null,
        fabricOrderedQuantityKg: data.fabricOrderedQuantityKg ? Number(data.fabricOrderedQuantityKg) : null,
        fabricShippedQuantityKg: data.fabricShippedQuantityKg ? Number(data.fabricShippedQuantityKg) : null,
        garmentNumber: data.garmentNumber ? Number(data.garmentNumber) : null,
        actualStitchedXS: Number(data.actualStitchedXS) || 0,
        actualStitchedS: Number(data.actualStitchedS) || 0,
        actualStitchedM: Number(data.actualStitchedM) || 0,
        actualStitchedL: Number(data.actualStitchedL) || 0,
        actualStitchedXL: Number(data.actualStitchedXL) || 0,
        actualStitchedXXL: Number(data.actualStitchedXXL) || 0,
        stitchingCost: data.stitchingCost ? Number(data.stitchingCost) : null,
        brandLogoCost: data.brandLogoCost ? Number(data.brandLogoCost) : null,
        neckTwillCost: data.neckTwillCost ? Number(data.neckTwillCost) : null,
        reflectorsCost: data.reflectorsCost ? Number(data.reflectorsCost) : null,
        fusingCost: data.fusingCost ? Number(data.fusingCost) : null,
        accessoriesCost: data.accessoriesCost ? Number(data.accessoriesCost) : null,
        brandTagCost: data.brandTagCost ? Number(data.brandTagCost) : null,
        sizeTagCost: data.sizeTagCost ? Number(data.sizeTagCost) : null,
        packagingCost: data.packagingCost ? Number(data.packagingCost) : null,
        outwardShippingCost: data.outwardShippingCost ? Number(data.outwardShippingCost) : null,
        proposedMrp: data.proposedMrp ? Number(data.proposedMrp) : null,
        onlineMrp: data.onlineMrp ? Number(data.onlineMrp) : null,
        garmentingAt: data.garmentingAt ? String(data.garmentingAt) : null,
        orderDate: data.orderDate ? String(data.orderDate) : null,
      };

      if (isEditing) {
        await updateProduct(product!.id, payload);
        toast.success("Product updated");
      } else {
        await createProduct(payload);
        toast.success("Product created");
      }
      router.push("/products");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Style Number (legacy) *</Label>
            <Input {...register("styleNumber", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Article Number</Label>
            <Input {...register("articleNumber")} />
          </div>
          <div className="space-y-1">
            <Label>Article Code</Label>
            <Input {...register("skuCode")} placeholder="e.g. M LO02 BLK" />
          </div>
          <div className="space-y-1">
            <Label>Colour Ordered *</Label>
            <Input {...register("colourOrdered", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Type *</Label>
            <Input {...register("type", { required: true })} placeholder="e.g. Lowers Strip" />
          </div>
          <div className="space-y-1">
            <Label>Gender *</Label>
            <Select
              value={String(watched.gender)}
              onValueChange={(v) => setValue("gender", v ?? "")}
            >
              <SelectTrigger>
                <span className="truncate">{GENDER_LABELS[String(watched.gender)] || "Select gender"}</span>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GENDER_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Product Name</Label>
            <Input {...register("productName")} placeholder="e.g. GLIDEFIT" />
          </div>
          <div className="space-y-1">
            <Label>Fabric Vendor *</Label>
            <Select
              value={String(watched.fabricVendorId)}
              onValueChange={(v) => setValue("fabricVendorId", v ?? "")}
            >
              <SelectTrigger>
                <span className="truncate">{vendors.find((v) => v.id === String(watched.fabricVendorId))?.name || "Select vendor"}</span>
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={String(watched.status)}
              onValueChange={(v) => setValue("status", v ?? "")}
            >
              <SelectTrigger>
                <span className="truncate">{PRODUCT_STATUS_LABELS[String(watched.status)] || "Select status"}</span>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Order Date</Label>
            <Input type="date" {...register("orderDate")} />
          </div>
          <div className="space-y-1">
            <Label>Garmenting At</Label>
            <Input {...register("garmentingAt")} placeholder="e.g. Garsem" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="isRepeat" {...register("isRepeat")} />
            <Label htmlFor="isRepeat">Repeat Design</Label>
          </div>
        </CardContent>
      </Card>

      {/* Fabric */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fabric</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Fabric Name *</Label>
            <Input {...register("fabricName", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>GSM</Label>
            <Input type="number" {...register("fabricGsm")} />
          </div>
          <div className="space-y-1">
            <Label>Cost/Kg</Label>
            <Input type="number" step="0.01" {...register("fabricCostPerKg")} />
          </div>
          <div className="space-y-1">
            <Label>Garments/Kg (No/Kg)</Label>
            <Input type="number" step="0.01" {...register("assumedFabricGarmentsPerKg")} />
          </div>
          <div className="col-span-full border-t pt-3">
            <Label className="text-xs text-muted-foreground">Second Fabric (optional)</Label>
          </div>
          <div className="space-y-1">
            <Label>2nd Fabric Name</Label>
            <Input {...register("fabric2Name")} />
          </div>
          <div className="space-y-1">
            <Label>2nd Fabric Cost/Kg</Label>
            <Input type="number" step="0.01" {...register("fabric2CostPerKg")} />
          </div>
          <div className="space-y-1">
            <Label>2nd Fabric Garments/Kg</Label>
            <Input type="number" step="0.01" {...register("assumedFabric2GarmentsPerKg")} />
          </div>
        </CardContent>
      </Card>

      {/* Quantities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quantities</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Fabric Ordered (Kg)</Label>
            <Input type="number" step="0.01" {...register("fabricOrderedQuantityKg")} />
          </div>
          <div className="space-y-1">
            <Label>Fabric Shipped (Kg)</Label>
            <Input type="number" step="0.01" {...register("fabricShippedQuantityKg")} />
          </div>
          <div className="space-y-1">
            <Label>Expected Garments</Label>
            <Input type="number" {...register("garmentNumber")} />
          </div>
        </CardContent>
      </Card>

      {/* Size Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Size Breakdown
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              (Total: {totalSizes})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-6 gap-4">
          {(["XS", "S", "M", "L", "XL", "XXL"] as const).map((size) => (
            <div key={size} className="space-y-1">
              <Label className="text-xs">{size}</Label>
              <Input
                type="number"
                {...register(`actualStitched${size}` as keyof FormValues, { valueAsNumber: true })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Garmenting Costs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Garmenting Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { key: "stitchingCost", label: "Stitching" },
              { key: "brandLogoCost", label: "Brand Logo" },
              { key: "neckTwillCost", label: "Neck Twill" },
              { key: "reflectorsCost", label: "Reflectors" },
              { key: "fusingCost", label: "Fusing" },
              { key: "accessoriesCost", label: "Accessories" },
              { key: "brandTagCost", label: "Brand Tag" },
              { key: "sizeTagCost", label: "Size Tag" },
              { key: "packagingCost", label: "Packaging" },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register(key as keyof FormValues)}
                />
              </div>
            ))}
            <ComputedField
              label="Total Garmenting"
              value={formatCurrency(totalGarmenting)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <ComputedField
            label="Fabric Cost/Piece"
            value={formatCurrency(fabricCostPerPiece)}
          />
          <div className="space-y-1">
            <Label className="text-xs">Outward Shipping Cost</Label>
            <Input type="number" step="0.01" {...register("outwardShippingCost")} />
          </div>
          <ComputedField
            label="Total Landed Cost"
            value={formatCurrency(totalLanded)}
          />
          <div className="space-y-1">
            <Label className="text-xs">Proposed MRP</Label>
            <Input type="number" step="0.01" {...register("proposedMrp")} />
          </div>
          <ComputedField label="DP (50%)" value={formatCurrency(dp)} />
          <ComputedField label="Profit Margin" value={formatPercent(pm)} />
          {Boolean(watched.isRepeat) && (
            <div className="space-y-1">
              <Label className="text-xs">Online MRP</Label>
              <Input type="number" step="0.01" {...register("onlineMrp")} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
