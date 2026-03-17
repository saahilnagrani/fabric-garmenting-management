import { getPhases, createPhase, setCurrentPhase } from "@/actions/phases";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { revalidatePath } from "next/cache";

export default async function PhasesPage() {
  const phases = await getPhases();

  async function handleCreate(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const number = parseInt(formData.get("number") as string);
    const startDate = formData.get("startDate") as string;
    if (!name || isNaN(number)) return;
    await createPhase({ name, number, startDate: startDate || undefined });
    revalidatePath("/phases");
  }

  async function handleSetCurrent(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    await setCurrentPhase(id);
    revalidatePath("/phases");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Phases</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Phase</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="flex items-end gap-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" required placeholder="e.g. Phase 4 - March 2026" />
            </div>
            <div className="space-y-1">
              <Label>Number</Label>
              <Input name="number" type="number" required placeholder="4" className="w-20" />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input name="startDate" type="date" />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phase</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {phases.map((phase) => (
              <TableRow key={phase.id}>
                <TableCell className="font-medium">{phase.name}</TableCell>
                <TableCell>{phase.number}</TableCell>
                <TableCell>
                  {phase.startDate
                    ? new Date(phase.startDate).toLocaleDateString("en-IN")
                    : "-"}
                </TableCell>
                <TableCell>
                  {phase.isCurrent ? (
                    <Badge className="bg-green-100 text-green-800">Current</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!phase.isCurrent && (
                    <form action={handleSetCurrent}>
                      <input type="hidden" name="id" value={phase.id} />
                      <Button variant="outline" size="sm" type="submit">
                        Set as Current
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
