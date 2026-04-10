import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette } from "lucide-react";
import { AppearanceControls } from "@/components/theme/appearance-controls";

export default function PreferencesPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Preferences</h1>
        <p className="text-muted-foreground">
          Personal settings that apply to your account only. Changes save
          instantly and persist in this browser.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-accent" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AppearanceControls variant="full" />
        </CardContent>
      </Card>
    </div>
  );
}
