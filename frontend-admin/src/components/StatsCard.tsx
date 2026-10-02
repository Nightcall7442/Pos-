import clsx from "clsx";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  yellow: "bg-yellow-50 text-yellow-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
};

export default function StatsCard({ title, value, change, icon, color = "blue" }: StatsCardProps) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        {change !== undefined && (
          <div className={clsx("mt-1 flex items-center gap-1 text-xs font-medium", change >= 0 ? "text-green-600" : "text-red-600")}>
            {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change)}% from yesterday
          </div>
        )}
      </div>
      <div className={clsx("flex h-12 w-12 items-center justify-center rounded-xl", colorMap[color])}>
        {icon}
      </div>
    </div>
  );
}
