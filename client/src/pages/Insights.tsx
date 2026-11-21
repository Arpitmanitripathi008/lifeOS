import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import {
  BookOpen,
  Target,
  Moon,
  Activity,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../services/api';

export function Insights() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLogSleepModal, setShowLogSleepModal] = useState(false);

  // Voluntary Sleep Form state
  const [sleepDate, setSleepDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bedTime, setBedTime] = useState('23:30');
  const [wakeTime, setWakeTime] = useState('07:30');
  const [sleepNotes, setSleepNotes] = useState('');
  const [isLoggingSleep, setIsLoggingSleep] = useState(false);
  const [sleepMessage, setSleepMessage] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const res = await api.getInsightsSummary();
      setData(res);
    } catch (err) {
      console.error('Error loading insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleSaveSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingSleep(true);
    try {
      await api.logSleep({
        date: sleepDate,
        bedTimeApprox: bedTime,
        wakeUpTime: wakeTime,
        notes: sleepNotes || 'Voluntary entry from Insights',
      });
      setShowLogSleepModal(false);
      setSleepNotes('');
      setSleepMessage('✓ Sleep entry recorded. Durations and rest metrics updated!');
      setTimeout(() => setSleepMessage(null), 5000);
      loadInsights();
    } catch (err: any) {
      alert(`Failed to log sleep: ${err.message}`);
    } finally {
      setIsLoggingSleep(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="LifeOS Insights & Analytics"
        subtitle="100% transparent analytics calculated from real stored records — never arbitrary scores"
        action={
          <Button
            size="sm"
            variant="secondary"
            icon={Moon}
            onClick={() => setShowLogSleepModal(true)}
          >
            Log Sleep Entry
          </Button>
        }
      />

      {sleepMessage && (
        <div className="p-3.5 rounded-lg bg-sage/30 border border-sage/60 text-xs text-olive-dark font-medium flex items-center justify-between">
          <span>{sleepMessage}</span>
          <button onClick={() => setSleepMessage(null)} className="text-muted hover:text-charcoal">
            <X size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <Card>
          <div className="py-16 text-center text-sm text-muted">Calculating analytics from database...</div>
        </Card>
      ) : (
        <>
          {/* Transparent Life Balance Card */}
          <Card className="border-olive/30 bg-paper">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border-light">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-sage/40 flex items-center justify-center text-olive">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-charcoal">Life Balance Dimensions</h3>
                  <p className="text-xs text-muted">
                    Overall Index: <strong className="text-olive">{data?.lifeBalance?.overallBalanceScore || 0}%</strong> • Computed from actual stored progress
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-muted bg-ivory px-2.5 py-1 rounded-md border border-border-light">
                Deterministic Formula
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data?.lifeBalance?.dimensions?.map((dim: any) => (
                <div
                  key={dim.name}
                  className="p-3.5 rounded-xl bg-ivory/60 border border-border-light space-y-2 text-center"
                >
                  <div className="w-14 h-14 mx-auto rounded-full border-2 border-olive/40 bg-sage/10 flex items-center justify-center">
                    <span className="text-base font-bold text-olive-dark font-mono">{dim.score}%</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-charcoal">{dim.name}</h4>
                    <p className="text-[10px] text-muted font-mono mt-0.5">{dim.formula}</p>
                    <p className="text-[10px] text-muted-light mt-1 italic">{dim.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 4 Core Pillars Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Academic Completion & Subject Progress */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-light">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-sage/30 text-olive">
                    <BookOpen size={16} />
                  </div>
                  <h3 className="text-sm font-semibold text-charcoal">Academic Mastery</h3>
                </div>
                <span className="text-xs font-mono font-semibold text-olive">
                  {data?.academic?.topicsCompleted || 0} / {data?.academic?.totalTopics || 0} Topics
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted">Curriculum Progress</span>
                  <span className="font-semibold text-charcoal">{data?.academic?.progressPercent || 0}%</span>
                </div>
                <ProgressBar value={data?.academic?.progressPercent || 0} color="olive" />

                {/* Subject by subject breakdown */}
                <div className="pt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {data?.academic?.subjectsBreakdown?.map((sub: any) => (
                    <div key={sub.id} className="p-2 rounded-lg bg-ivory text-xs border border-border-light">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-charcoal truncate">{sub.name}</span>
                        <span className="font-mono text-muted text-[11px]">
                          {sub.completedTopics}/{sub.totalTopics} ({sub.progressPercent}%)
                        </span>
                      </div>
                      <ProgressBar value={sub.progressPercent} size="sm" color="olive" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* 2. Personal Growth Goals */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-light">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-terracotta/15 text-terracotta">
                    <Target size={16} />
                  </div>
                  <h3 className="text-sm font-semibold text-charcoal">Personal Growth</h3>
                </div>
                <span className="text-xs font-mono font-semibold text-terracotta">
                  {data?.growth?.completedSessionsThisWeek || 0} / {data?.growth?.targetSessionsThisWeek || 0} Sessions
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted">Weekly Goal Adherence</span>
                  <span className="font-semibold text-charcoal">{data?.growth?.consistencyPercent || 0}%</span>
                </div>
                <ProgressBar value={data?.growth?.consistencyPercent || 0} color="terracotta" />

                <div className="pt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                  {data?.growth?.goalsBreakdown?.map((g: any) => (
                    <div key={g.id} className="p-2 rounded-lg bg-ivory text-xs border border-border-light">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-charcoal">{g.name}</span>
                        <span className="font-mono text-muted text-[11px]">
                          {g.completedThisWeek} / {g.prefSessionsPerWeek} sessions ({g.consistencyPercent}%)
                        </span>
                      </div>
                      <ProgressBar value={g.consistencyPercent} size="sm" color="terracotta" />
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* 3. Task Execution & Postponement Analytics */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-light">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-sage/20 text-olive">
                    <CheckCircle2 size={16} />
                  </div>
                  <h3 className="text-sm font-semibold text-charcoal">Task Execution & Postponements</h3>
                </div>
                <span className="text-xs font-mono font-semibold text-charcoal">
                  {data?.tasks?.completionRate || 0}% Follow-Through
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center mb-3 p-2.5 rounded-lg bg-ivory">
                <div>
                  <p className="text-[10px] text-muted">Completed</p>
                  <p className="text-sm font-semibold text-olive">{data?.tasks?.completed || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">Partial</p>
                  <p className="text-sm font-semibold text-terracotta">{data?.tasks?.partial || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">Postponed</p>
                  <p className="text-sm font-semibold text-charcoal">{data?.tasks?.postponed || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">Cancelled</p>
                  <p className="text-sm font-semibold text-muted-light">{data?.tasks?.cancelled || 0}</p>
                </div>
              </div>

              {/* Postponement Reasons Frequency */}
              <div>
                <p className="text-xs font-semibold text-charcoal mb-1.5 uppercase tracking-wider text-[11px]">
                  Postponement Root Causes (Recorded):
                </p>
                {Object.keys(data?.tasks?.postponedReasons || {}).length === 0 ? (
                  <p className="text-xs text-muted-light italic">No postponed task reasons logged yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {Object.entries(data?.tasks?.postponedReasons || {}).map(([reason, count]) => (
                      <div
                        key={reason}
                        className="flex items-center justify-between p-1.5 rounded bg-ivory text-xs border border-border-light"
                      >
                        <span className="text-charcoal truncate">{reason}</span>
                        <span className="font-mono text-muted text-[11px] font-semibold">{count as number}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* 4. Sleep Trends & Voluntary Rest Log */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-light">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-beige text-charcoal">
                    <Moon size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-charcoal">Sleep & Recovery Trends</h3>
                    <p className="text-[10px] text-muted">Voluntary entries only • Zero bedtime judgment</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowLogSleepModal(true)}>
                  + Log Sleep
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3 p-2.5 rounded-lg bg-ivory text-center">
                <div>
                  <p className="text-[10px] text-muted">Weekly Average Rest</p>
                  <p className="text-sm font-semibold text-charcoal">
                    {data?.sleep?.weeklyAverageFormatted || 'No logs yet'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">Days Recorded</p>
                  <p className="text-sm font-semibold text-olive">
                    {data?.sleep?.recordsCount || 0} / 7 Days
                  </p>
                </div>
              </div>

              {/* Chronological Sleep Entries */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {data?.sleep?.records?.length === 0 ? (
                  <p className="text-xs text-muted-light italic text-center py-4">
                    No voluntary sleep logs recorded yet. Log approximate sleep/wake times to see recovery trends.
                  </p>
                ) : (
                  data?.sleep?.records?.map((s: any) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-paper text-xs border border-border-light"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-charcoal">{s.date}</span>
                        <span className="text-muted text-[11px]">
                          ({s.bedTimeApprox || '—'} → {s.wakeUpTime})
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-olive">
                        {s.durationMinutes ? `${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m` : '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Voluntary Sleep Entry Modal */}
      {showLogSleepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border-light">
              <h3 className="text-base font-semibold text-charcoal flex items-center gap-2">
                <Moon size={16} className="text-olive" />
                Voluntary Sleep Log
              </h3>
              <button onClick={() => setShowLogSleepModal(false)} className="text-muted hover:text-charcoal">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted">
              LifeOS does not enforce mandatory bedtimes or invent missing records. Enter your approximate sleep and wake-up times to track your natural rest patterns.
            </p>

            <form onSubmit={handleSaveSleep} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Morning Date</label>
                <input
                  type="date"
                  required
                  value={sleepDate}
                  onChange={(e) => setSleepDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border-light bg-ivory text-xs font-mono text-charcoal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Approx Bed Time</label>
                  <input
                    type="time"
                    required
                    value={bedTime}
                    onChange={(e) => setBedTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border-light bg-ivory text-xs font-mono text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Wake-Up Time</label>
                  <input
                    type="time"
                    required
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-border-light bg-ivory text-xs font-mono text-charcoal"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Notes / Energy (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Woke up refreshed, worked late on assignment"
                  value={sleepNotes}
                  onChange={(e) => setSleepNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border-light bg-ivory text-xs text-charcoal"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-light">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowLogSleepModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isLoggingSleep}>
                  {isLoggingSleep ? 'Saving...' : 'Save Sleep Entry'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
