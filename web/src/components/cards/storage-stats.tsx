import { Card, CardContent } from "@/components/ui/card";
import { HardDrive } from "lucide-react";

type StorageStatCardProps = {
  totalSize: number;
  totalSizeHuman: string;
  fileCount?: number;
  label?: string;
};

export function StorageStatCard({
  totalSize,
  totalSizeHuman,
  fileCount,
  label = "Total storage used"
}: StorageStatCardProps) {
  return (
    <Card className="shadow-sm max-w-xs min-w-xs">
      <CardContent className="flex items-center justify-between p-4 sm:p-5">
        <div>
          <div className="text-2xl font-semibold leading-none">{totalSizeHuman}</div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
          {fileCount !== undefined && (
            <div className="mt-1 text-xs text-muted-foreground">
              {fileCount.toLocaleString()} files
            </div>
          )}
        </div>
        <div className="rounded-xl bg-primary/10 p-3">
          <HardDrive className="h-6 w-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
