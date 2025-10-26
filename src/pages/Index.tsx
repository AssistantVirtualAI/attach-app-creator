import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
import { ChartCard } from "@/components/ChartCard";
import { Users, TrendingUp, Activity, Award } from "lucide-react";

const Index = () => {
  // Sample data for statistics
  const stats = [
    {
      title: "Total Users",
      value: "12,543",
      change: "+12.5%",
      changeType: "positive" as const,
      icon: Users,
      trend: [40, 60, 45, 70, 55, 80, 75],
    },
    {
      title: "Active Sessions",
      value: "8,432",
      change: "+8.2%",
      changeType: "positive" as const,
      icon: Activity,
      trend: [30, 50, 40, 60, 70, 65, 85],
    },
    {
      title: "Growth Rate",
      value: "23.8%",
      change: "-2.4%",
      changeType: "negative" as const,
      icon: TrendingUp,
      trend: [70, 65, 75, 60, 55, 50, 45],
    },
    {
      title: "Achievements",
      value: "156",
      change: "+18",
      changeType: "positive" as const,
      icon: Award,
      trend: [20, 40, 35, 55, 65, 75, 90],
    },
  ];

  // Sample data for charts
  const weeklyData = [
    { day: "Mon", value: 2400 },
    { day: "Tue", value: 1398 },
    { day: "Wed", value: 9800 },
    { day: "Thu", value: 3908 },
    { day: "Fri", value: 4800 },
    { day: "Sat", value: 3800 },
    { day: "Sun", value: 4300 },
  ];

  const monthlyData = [
    { month: "Jan", value: 4000 },
    { month: "Feb", value: 3000 },
    { month: "Mar", value: 2000 },
    { month: "Apr", value: 2780 },
    { month: "May", value: 1890 },
    { month: "Jun", value: 2390 },
  ];

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-3">Dashboard Overview</h2>
          <p className="text-muted-foreground text-lg">
            Real-time analytics and performance metrics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Weekly Activity"
            data={weeklyData}
            type="area"
            dataKey="value"
            xAxisKey="day"
          />
          <ChartCard
            title="Monthly Trends"
            data={monthlyData}
            type="bar"
            dataKey="value"
            xAxisKey="month"
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
