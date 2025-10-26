import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  trend?: number[];
}

export const StatCard = ({ title, value, change, changeType = "neutral", icon: Icon, trend }: StatCardProps) => {
  const changeColors = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className="stat-card glass-card p-6 border-border/50">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        {change && (
          <span className={`text-sm font-semibold ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {trend && (
        <div className="mt-4 h-12 flex items-end gap-1">
          {trend.map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-primary to-primary-glow rounded-t opacity-50"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      )}
    </Card>
  );
};
