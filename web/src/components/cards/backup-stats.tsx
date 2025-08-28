import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";

type BackupStatCardProps = {
  running?: number;
  successRate?: number;
  completedToday?: number;
  failedToday?: number;
  label?: string;
};

export function BackupStatCard({
  running = 0,
  successRate = 100,
  completedToday = 0,
  failedToday = 0,
  label = "Backup activity"
}: BackupStatCardProps) {
  const getStatusColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBg = (rate: number) => {
    if (rate >= 90) return "bg-green-500/10";
    if (rate >= 70) return "bg-yellow-500/10";
    return "bg-red-500/10";
  };

  return (
    <Card className="shadow-sm max-w-xs min-w-xs">
      <CardContent className="flex items-center justify-between p-4 sm:p-5">
        <div>
          <div className="text-2xl font-semibold leading-none">
            {successRate}%
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 flex items-center space-x-4 text-xs">
            {running > 0 && (
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                <span>{running} running</span>
              </div>
            )}
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span>{completedToday} completed</span>
            </div>
            {failedToday > 0 && (
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                <span>{failedToday} failed</span>
              </div>
            )}
          </div>
        </div>
        <div className={`rounded-xl p-3 ${getStatusBg(successRate)}`}>
          <Activity className={`h-6 w-6 ${getStatusColor(successRate)}`} />
        </div>
      </CardContent>
    </Card>
  );
}
