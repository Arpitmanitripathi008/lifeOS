import { useState } from 'react';
import { GreetingHeader } from '../components/dashboard/QuickActions';
import { AICommandCenter } from '../components/dashboard/AICommandCenter';
import { DailyOverview } from '../components/dashboard/DailyOverview';
import { TodayTimeline } from '../components/dashboard/TodayTimeline';

export function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <GreetingHeader key={`greeting-${refreshKey}`} />

      {/* AI Command Center - prominent position */}
      <AICommandCenter onScheduleUpdated={handleRefresh} />

      {/* Quick stats */}
      <DailyOverview key={`overview-${refreshKey}`} />

      {/* Today's schedule */}
      <TodayTimeline key={`timeline-${refreshKey}`} />
    </div>
  );
}
