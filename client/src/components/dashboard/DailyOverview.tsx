import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Clock, CheckCircle2, Circle, AlertTriangle, Coffee, Sparkles } from 'lucide-react';
import { api } from '../../services/api';

export function DailyOverview() {
  const [metrics, setMetrics] = useState({
    pending: '0',
    completed: '0',
    deadlines: '0',
    focusTime: '0h 0m',
    freeTime: '—',
    growth: '0/0',
  });

  useEffect(() => {
    Promise.all([
      api.getDaySchedule().catch(() => null),
      api.getInsightsSummary().catch(() => null),
    ]).then(([day, insights]) => {
      setMetrics({
        pending: day?.metrics?.pendingTasks?.toString() || '0',
        completed: day?.metrics?.completedTasks?.toString() || '0',
        deadlines: day?.tasks?.filter((t: any) => t.category === 'DEADLINE')?.length?.toString() || '0',
        focusTime: insights?.productivity?.todayFocusFormatted || '0h 0m',
        freeTime: '4h 30m',
        growth: `${insights?.growth?.completedSessionsThisWeek || 0}/${insights?.growth?.targetSessionsThisWeek || 0}`,
      });
    });
  }, []);

  const overviewItems = [
    { icon: Circle, label: 'Pending', value: metrics.pending, color: 'text-muted' },
    { icon: CheckCircle2, label: 'Completed', value: metrics.completed, color: 'text-olive' },
    { icon: AlertTriangle, label: 'Deadlines', value: metrics.deadlines, color: 'text-terracotta' },
    { icon: Clock, label: 'Focus Time', value: metrics.focusTime, color: 'text-olive' },
    { icon: Coffee, label: 'Free Time', value: metrics.freeTime, color: 'text-muted' },
    { icon: Sparkles, label: 'Growth', value: metrics.growth, color: 'text-olive' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {overviewItems.map((item) => (
        <Card key={item.label} padding="sm" className="text-center">
          <item.icon size={18} strokeWidth={1.5} className={`mx-auto mb-1.5 ${item.color}`} />
          <p className="text-lg font-semibold text-charcoal">{item.value}</p>
          <p className="text-[11px] text-muted">{item.label}</p>
        </Card>
      ))}
    </div>
  );
}
