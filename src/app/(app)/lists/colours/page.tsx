import { getColours } from "@/actions/colours";
import { ColourList } from "@/components/lists/colour-list";

export default async function ColoursPage() {
  const colours = await getColours();

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-2xl font-bold">Colours</h1>
      <p className="text-sm text-muted-foreground">
        {colours.length} colours. These appear as options when selecting colours in Fabric and Article Masters.
      </p>
      <ColourList colours={colours} />
    </div>
  );
}
