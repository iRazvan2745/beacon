import { Card, CardContent } from "@/components/ui/card";
import { Archive } from "lucide-react";

type StatCardProps = {
  value: number | string;
  label?: string;
};

export function SnapshotsStatCard({ value, label = "Total snapshots" }: StatCardProps) {
  return (
    <Card className="shadow-sm max-w-xs min-w-xs">
      <CardContent className="flex items-center justify-between p-4 sm:p-5">
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
        </div>
        <div className="rounded-xl bg-primary/10 p-3">
          <Archive className="h-6 w-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}