import { getProductTypes } from "@/actions/product-types";
import { db } from "@/lib/db";
import { ProductTypeList } from "@/components/lists/product-type-list";

const INITIAL_TYPES = [
  "Cricket Whites",
  "Double Coloured",
  "Full Sleeved now Polo",
  "Ice Blaze",
  "Kids Jacket with Zip",
  "Kids Round Neck with Half Sleeve",
  "Kids Round Neck with Shorts",
  "Limitless Tshirt",
  "Lowers Mesh",
  "Lowers NS with Invi Zip",
  "Lowers Strip",
  "Mens Polo",
  "Mens Round Neck",
  "Mens round neck colourful reflector",
  "Mens Track with Mesh",
  "Mesh at Back",
  "Polo",
  "Shorts Back Piping",
  "Shorts Cut & Sew",
  "Single Coloured",
  "Tshirt with Embose",
  "Two Colourd Tshirt",
  "Two layered Shorts",
  "Womens Cut & Sew Panel Tshirt",
  "Womens Polo",
  "Womens Round Neck",
  "Womens Shorts",
  "Womens Tshirt",
  "Womens two Layered Shorts",
  "Womens V Neck Net Design Tshirt",
];

export default async function ProductTypesPage() {
  // Seed initial types if table is empty (direct db call, no revalidatePath during render)
  const count = await db.productType.count();
  if (count === 0) {
    await db.productType.createMany({
      data: INITIAL_TYPES.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }
  const types = await getProductTypes();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Product Types</h1>
      <p className="text-sm text-muted-foreground">
        {types.length} types. These appear as options in the Product Master &quot;Type&quot; dropdown.
      </p>
      <ProductTypeList types={types} />
    </div>
  );
}
