import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import {
  CalendarDays,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Sparkles,
  AlertCircle,
  Coffee,
  ShieldCheck,
  X,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  Pencil,
} from 'lucide-react';
import { api } from '../services/api';

type ViewMode = 'day' | 'week' | 'timeline';

export function Planner() {
  const [view, setView] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dayData, setDayData] = useState<any>(null);
  const [weekData, setWeekData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingProposal, setPendingProposal] = useState<any>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Add Task form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('DEADLINE');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newDuration, setNewDuration] = useState(45);
  const [newTime, setNewTime] = useState('');
  const [taskScheduledDate, setTaskScheduledDate] = useState(currentDate);
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  // Generate Plan form state
  const [genWakeUp, setGenWakeUp] = useState('07:30');
  const [hasUnavailWindow, setHasUnavailWindow] = useState(false);
  const [unavailStart, setUnavailStart] = useState('16:00');
  const [unavailEnd, setUnavailEnd] = useState('18:00');
  const [unavailReason, setUnavailReason] = useState('Personal commitment');

  const loadPlannerData = async () => {
    setLoading(true);
    try {
      const [dayRes, weekRes, proposals, subs] = await Promise.all([
        api.getDaySchedule(currentDate),
        api.getWeekSchedule(),
        api.getProposals({ targetDate: currentDate, status: 'PENDING' }),
        api.getSubjects().catch(() => []),
      ]);
      setDayData(dayRes);
      setWeekData(weekRes);
      if (subs) setSubjects(subs);

      // Set detected wake up time if present
      if (dayRes.sleep?.wakeUpTime) {
        setGenWakeUp(dayRes.sleep.wakeUpTime);
      } else if (dayRes.dailySchedule?.wakeUpTime) {
        setGenWakeUp(dayRes.dailySchedule.wakeUpTime);
      }

      if (proposals && proposals.length > 0) {
        setPendingProposal(proposals[0]);
      } else {
        setPendingProposal(null);
      }
    } catch (err) {
      console.error('Failed to load planner data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTaskScheduledDate(currentDate);
    loadPlannerData();
  }, [currentDate]);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    await api.updateTask(taskId, { status: nextStatus });
    loadPlannerData();
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete task "${taskTitle}"?`)) {
      try {
        await api.deleteTask(taskId);
        setActionSuccess(`Task "${taskTitle}" deleted.`);
        setTimeout(() => setActionSuccess(null), 3000);
        loadPlannerData();
      } catch (err: any) {
        alert(err.message || 'Error deleting task');
      }
    }
  };

  const handleEditTask = (task: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setNewTitle(task.title || '');
    setNewCategory(task.category || 'DEADLINE');
    setNewPriority(task.priority || 'MEDIUM');
    setNewDuration(task.estimatedDuration || 45);
    setNewTime(task.scheduledStartTime || '');
    setTaskScheduledDate(task.scheduledDate || currentDate);
    setTaskDeadline(task.deadline || '');
    setTaskSubjectId(task.subjectId || '');
    setShowAddModal(true);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const payload = {
      title: newTitle,
      category: newCategory,
      priority: newPriority,
      estimatedDuration: Number(newDuration),
      scheduledDate: taskScheduledDate || currentDate,
      scheduledStartTime: newTime || null,
      deadline: taskDeadline || null,
      subjectId: taskSubjectId || null,
    };

    if (editingTask) {
      await api.updateTask(editingTask.id, payload);
      setActionSuccess(`Task "${newTitle}" updated.`);
    } else {
      await api.createTask(payload);
      setActionSuccess(`Task "${newTitle}" created.`);
    }
    setTimeout(() => setActionSuccess(null), 3000);

    setEditingTask(null);
    setNewTitle('');
    setNewTime('');
    setTaskDeadline('');
    setTaskSubjectId('');
    setShowAddModal(false);
    loadPlannerData();
  };

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    try {
      const unavailableWindows = hasUnavailWindow
        ? [{ startTime: unavailStart, endTime: unavailEnd, reason: unavailReason }]
        : [];

      const res = await api.generateSchedule({
        date: currentDate,
        wakeUpTime: genWakeUp,
        unavailableWindows,
      });

      if (res.proposal) {
        setPendingProposal(res.proposal);
        setShowGenerateModal(false);
        setActionSuccess('✓ Adaptive plan proposed! Review details below.');
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err: any) {
      alert(`Scheduling error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModifySchedule = async () => {
    setIsGenerating(true);
    try {
      const res = await api.modifySchedule({
        date: currentDate,
        unavailableStart: unavailStart,
        unavailableEnd: unavailEnd,
        reason: unavailReason,
      });

      if (res.proposal) {
        setPendingProposal(res.proposal);
        setShowModifyModal(false);
        setActionSuccess('✓ Rescheduled around unavailable window! Review below.');
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err: any) {
      alert(`Modification error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveProposal = async () => {
    if (!pendingProposal?.id) return;
    try {
      await api.acceptProposal(pendingProposal.id);
      setPendingProposal(null);
      setActionSuccess('✓ Plan approved and permanently saved to your schedule!');
      setTimeout(() => setActionSuccess(null), 5000);
      loadPlannerData();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleDismissProposal = async () => {
    if (!pendingProposal?.id) return;
    try {
      await api.rejectProposal(pendingProposal.id);
      setPendingProposal(null);
      loadPlannerData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const viewButtons: { mode: ViewMode; icon: any; label: string }[] = [
    { mode: 'day', icon: Calendar, label: 'Day' },
    { mode: 'week', icon: CalendarDays, label: 'Week' },
    { mode: 'timeline', icon: Clock, label: 'Timeline' },
  ];

  // Parse proposal data for rich preview
  let parsedProposalData: any = null;
  if (pendingProposal?.proposalData) {
    try {
      parsedProposalData = JSON.parse(pendingProposal.proposalData);
    } catch {
      parsedProposalData = null;
    }
  }

  const tasks = dayData?.tasks || [];
  const commitments = dayData?.commitments || [];
  const timeline = dayData?.timeline || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Planner"
        subtitle="Intelligent, conflict-free scheduling that adapts to your waking hours"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={SlidersHorizontal}
              onClick={() => setShowModifyModal(true)}
            >
              Block Unavailable
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Sparkles}
              onClick={() => setShowGenerateModal(true)}
            >
              Generate Plan
            </Button>
            <Button
              icon={Plus}
              size="sm"
              onClick={() => {
                setEditingTask(null);
                setNewTitle('');
                setNewTime('');
                setTaskDeadline('');
                setTaskSubjectId('');
                setTaskScheduledDate(currentDate);
                setShowAddModal(true);
              }}
            >
              Add Task
            </Button>
          </div>
        }
      />

      {/* Success alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-lg bg-sage/30 border border-sage/60 text-xs text-olive-dark font-medium flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-muted hover:text-charcoal">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Active Holiday Override Banner */}
      {dayData?.activeOverride && (
        <div className="p-3.5 rounded-xl bg-sage/30 border border-sage/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-olive-dark">
            <div className="w-7 h-7 rounded-lg bg-olive/15 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-olive" />
            </div>
            <div>
              <p className="font-semibold text-charcoal">
                {dayData.activeOverride.overrideType === 'HALF_DAY'
                  ? 'Half-Day College Schedule Active'
                  : dayData.activeOverride.overrideType === 'CUSTOM_HOURS'
                  ? `Modified College Hours (${dayData.activeOverride.adjustedStartTime} – ${dayData.activeOverride.adjustedEndTime})`
                  : 'Temporary College Holiday Active'}
              </p>
              <p className="text-muted text-[11px]">
                College commitments temporarily adjusted for this date. Your recurring weekly timetable remains preserved.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-terracotta hover:bg-terracotta/10 shrink-0 text-xs font-medium"
            onClick={async () => {
              await api.undoScheduleOverride(currentDate);
              loadPlannerData();
            }}
          >
            Undo Holiday Override
          </Button>
        </div>
      )}

      {/* Regular Weekly Holiday Notice */}
      {!dayData?.activeOverride && dayData?.isWeeklyHoliday && (
        <div className="p-2.5 rounded-xl bg-beige/40 border border-beige/60 text-xs text-charcoal flex items-center gap-2">
          <Calendar size={15} className="text-olive shrink-0" />
          <span>Weekly holiday schedule: College commitments are automatically excluded.</span>
        </div>
      )}

      {/* Pending AI Proposal Preview Card */}
      {pendingProposal && parsedProposalData && (
        <Card className="border-olive/30 bg-paper">
          <div className="flex items-start justify-between gap-4 border-b border-border-light pb-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-olive/15 text-olive">
                  {pendingProposal.proposalType === 'DAILY_SCHEDULE'
                    ? 'Adaptive Schedule Proposal'
                    : 'Schedule Modification Proposal'}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-olive font-medium">
                  <ShieldCheck size={13} />
                  Zero Overlaps Invariant Verified
                </span>
              </div>
              <p className="text-xs text-charcoal font-medium mt-1">
                {pendingProposal.explanation || 'Proposed conflict-free schedule tailored to your available hours.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleDismissProposal}>
                Decline
              </Button>
              <Button size="sm" onClick={handleApproveProposal} icon={CheckCircle2}>
                Approve & Save
              </Button>
            </div>
          </div>

          {/* Metrics row */}
          {parsedProposalData.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 p-2.5 rounded-lg bg-ivory text-center">
              <div>
                <p className="text-[10px] text-muted">Focused Study</p>
                <p className="text-sm font-semibold text-charcoal">
                  {Math.round(parsedProposalData.metrics.totalWorkMinutes / 60 * 10) / 10}h
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Fixed Commitments</p>
                <p className="text-sm font-semibold text-charcoal">
                  {Math.round(parsedProposalData.metrics.totalFixedMinutes / 60 * 10) / 10}h
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Buffer & Rest</p>
                <p className="text-sm font-semibold text-charcoal">
                  {parsedProposalData.metrics.totalBufferMinutes}m
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Conflicts</p>
                <p className="text-sm font-semibold text-olive">0 Conflicts</p>
              </div>
            </div>
          )}

          {/* Proposed Activities Preview */}
          {parsedProposalData.scheduledActivities && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                Proposed Timeline Sequence
              </p>
              {parsedProposalData.scheduledActivities.map((act: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-xs border flex items-center justify-between ${
                    act.category === 'FIXED'
                      ? 'bg-beige/30 border-beige/60 text-charcoal'
                      : act.category === 'HEALTH'
                      ? 'bg-sage/20 border-sage/40 text-olive-dark'
                      : act.category === 'PERSONAL_GROWTH'
                      ? 'bg-paper border-olive/30 text-charcoal'
                      : 'bg-paper border-border-light text-charcoal'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted font-medium w-24">
                      {act.startTime} – {act.endTime}
                    </span>
                    <span className="font-medium">{act.title}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-border-light text-muted">
                      {act.category}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-light font-mono">
                    {act.durationMinutes}m
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Overflow tasks notice */}
          {parsedProposalData.overflowTasks && parsedProposalData.overflowTasks.length > 0 && (
            <div className="mt-3 p-2.5 rounded bg-terracotta/10 border border-terracotta/30 text-xs">
              <p className="font-semibold text-terracotta mb-1 flex items-center gap-1">
                <AlertCircle size={13} />
                Moved to Tomorrow to Prevent Burnout (Max 6h Daily Focus Reached)
              </p>
              <div className="space-y-1 pl-4">
                {parsedProposalData.overflowTasks.map((ov: any, idx: number) => (
                  <p key={idx} className="text-muted text-[11px]">
                    • <span className="font-medium text-charcoal">{ov.title}</span> ({ov.estimatedDuration}m) – {ov.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* View Switcher & Date Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-beige-light rounded-lg p-1 w-fit">
          {viewButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === mode
                  ? 'bg-paper text-charcoal shadow-xs'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(new Date().toISOString().split('T')[0])}
          >
            Today
          </Button>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="px-2.5 py-1 rounded-md border border-border-light bg-paper text-xs text-charcoal font-medium"
          />
        </div>
      </div>

      {loading ? (
        <Card>
          <div className="py-16 text-center text-sm text-muted flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-olive" />
            Loading adaptive schedule...
          </div>
        </Card>
      ) : view === 'day' ? (
        /* DAY VIEW */
        <Card>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light">
            <div>
              <h2 className="text-base font-semibold text-charcoal">
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date(`${currentDate}T00:00:00`))}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Wake-up time: <span className="font-mono font-medium text-charcoal">{dayData?.sleep?.wakeUpTime || dayData?.dailySchedule?.wakeUpTime || '07:30 (default)'}</span>
                {dayData?.dailySchedule?.isFinalized && (
                  <span className="ml-2 text-olive font-medium">• Finalized & Protected</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-ivory text-muted font-medium">
                {dayData?.metrics?.completedTasks || 0} / {dayData?.metrics?.totalTasks || 0} Tasks Done
              </span>
            </div>
          </div>

          {/* Chronological hourly slots */}
          <div className="border-t border-border-light divide-y divide-border-light/60">
            {Array.from({ length: 17 }, (_, i) => i + 7).map((hour) => {
              const hourStr = hour.toString().padStart(2, '0');
              const slotLabel = hour === 12 ? '12:00 PM' : hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;

              // Find matching tasks in this hour
              const slotTasks = tasks.filter(
                (t: any) => t.scheduledStartTime && t.scheduledStartTime.startsWith(hourStr)
              );

              // Find matching commitments
              const currentDayOfWeek = new Date(`${currentDate}T00:00:00`).getDay();
              const slotCommitments = commitments.filter((c: any) => {
                const matchDay = (c.isRecurring && c.dayOfWeek === currentDayOfWeek) || c.specificDate === currentDate;
                return matchDay && c.startTime && c.startTime.startsWith(hourStr);
              });

              // Check if breakfast/lunch/dinner is in this hour
              const breakfastHour = (dayData?.profile?.breakfastTime || '08:00').split(':')[0];
              const lunchHour = (dayData?.profile?.lunchTime || '13:00').split(':')[0];
              const dinnerHour = (dayData?.profile?.dinnerTime || '20:00').split(':')[0];

              const meal =
                hourStr === breakfastHour
                  ? { name: 'Breakfast & Recovery', time: dayData?.profile?.breakfastTime || '08:00' }
                  : hourStr === lunchHour
                  ? { name: 'Lunch & Rest Break', time: dayData?.profile?.lunchTime || '13:00' }
                  : hourStr === dinnerHour
                  ? { name: 'Dinner & Wind-Down', time: dayData?.profile?.dinnerTime || '20:00' }
                  : null;

              return (
                <div key={hour} className="flex min-h-[4rem] group hover:bg-ivory/40 transition-colors">
                  <div className="w-20 shrink-0 py-2.5 pr-3 text-right">
                    <span className="text-[11px] text-muted-light font-mono font-medium">{slotLabel}</span>
                  </div>
                  <div className="flex-1 border-l border-border-light p-2 space-y-2">
                    {/* Fixed Commitments */}
                    {slotCommitments.map((c: any) => (
                      <div
                        key={c.id}
                        className="px-3 py-1.5 rounded-lg bg-beige/35 border border-beige/70 text-xs text-charcoal flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-olive"></span>
                          <span className="font-semibold text-charcoal">{c.title}</span>
                          <span className="text-[10px] text-olive-dark font-medium bg-beige/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Fixed Class / Lab
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-muted">
                          {c.startTime} – {c.endTime}
                        </span>
                      </div>
                    ))}

                    {/* Meal Protected Slot */}
                    {meal && slotCommitments.length === 0 && (
                      <div className="px-3 py-1.5 rounded-lg bg-sage/20 border border-sage/40 text-xs text-olive-dark flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coffee size={13} className="text-olive" />
                          <span className="font-medium">{meal.name}</span>
                          <span className="text-[10px] text-olive font-semibold uppercase tracking-wider">
                            Protected Health
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-muted">{meal.time}</span>
                      </div>
                    )}

                    {/* Flexible Scheduled Tasks */}
                    {slotTasks.map((t: any) => (
                      <div
                        key={t.id}
                        onClick={() => handleToggleTask(t.id, t.status)}
                        className={`px-3 py-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                          t.status === 'COMPLETED'
                            ? 'bg-sage/15 border-sage/40 line-through text-muted'
                            : 'bg-paper border-border-light hover:border-olive text-charcoal shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {t.status === 'COMPLETED' ? (
                            <CheckCircle2 size={15} className="text-olive shrink-0" />
                          ) : (
                            <Circle size={15} className="text-muted shrink-0 hover:text-olive" />
                          )}
                          <div>
                            <span className="font-medium text-charcoal">{t.title}</span>
                            {t.category === 'PERSONAL_GROWTH' && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-olive/15 text-olive">
                                Growth
                              </span>
                            )}
                            {t.priority === 'URGENT' && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-terracotta/15 text-terracotta">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-muted">
                            {t.scheduledStartTime} – {t.scheduledEndTime || '—'} ({t.estimatedDuration}m)
                          </span>
                          <button
                            onClick={(e) => handleEditTask(t, e)}
                            className="p-1 rounded text-muted hover:text-olive hover:bg-olive/10 transition-colors"
                            title={`Edit "${t.title}"`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTask(t.id, t.title, e)}
                            className="p-1 rounded text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors"
                            title={`Delete "${t.title}"`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unscheduled / Flexible Tasks for this Day */}
          {tasks.filter((t: any) => !t.scheduledStartTime).length > 0 && (
            <div className="mt-4 pt-3 border-t border-border-light">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-charcoal flex items-center gap-1.5">
                  <Clock size={13} className="text-olive" />
                  Flexible & Unscheduled Tasks ({tasks.filter((t: any) => !t.scheduledStartTime).length})
                </h3>
                <span className="text-[11px] text-muted">Click to toggle done, or edit to assign a specific time</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {tasks.filter((t: any) => !t.scheduledStartTime).map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => handleToggleTask(t.id, t.status)}
                    className={`px-3 py-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      t.status === 'COMPLETED'
                        ? 'bg-sage/15 border-sage/40 line-through text-muted'
                        : 'bg-paper border-border-light hover:border-olive text-charcoal'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {t.status === 'COMPLETED' ? (
                        <CheckCircle2 size={15} className="text-olive shrink-0" />
                      ) : (
                        <Circle size={15} className="text-muted shrink-0 hover:text-olive" />
                      )}
                      <span className="font-medium text-charcoal truncate">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-mono text-muted">{t.estimatedDuration}m</span>
                      <button
                        onClick={(e) => handleEditTask(t, e)}
                        className="p-1 rounded text-muted hover:text-olive hover:bg-olive/10 transition-colors"
                        title={`Edit "${t.title}"`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTask(t.id, t.title, e)}
                        className="p-1 rounded text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors"
                        title={`Delete "${t.title}"`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : view === 'week' ? (
        /* WEEK VIEW */
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-charcoal">Week Overview</h2>
              <p className="text-xs text-muted">
                {weekData?.startDate} to {weekData?.endDate}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {(weekData?.days || []).map((day: any) => {
              const isToday = day.date === new Date().toISOString().split('T')[0];
              const isSelected = day.date === currentDate;

              return (
                <div
                  key={day.date}
                  onClick={() => setCurrentDate(day.date)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-olive bg-sage/10 ring-1 ring-olive/40'
                      : isToday
                      ? 'border-border bg-paper'
                      : 'border-border-light bg-ivory/50 hover:bg-paper'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-charcoal">{day.dayName}</p>
                    <span className="text-[10px] font-mono text-muted">
                      {day.date.split('-').slice(1).join('/')}
                    </span>
                  </div>

                  <div className="space-y-1.5 min-h-[14rem]">
                    {/* Commitments */}
                    {day.commitments.map((c: any) => (
                      <div
                        key={c.id}
                        className="p-1.5 rounded bg-beige/40 border border-beige/60 text-[10px] text-charcoal"
                        title={`${c.title} (${c.startTime}–${c.endTime})`}
                      >
                        <p className="font-semibold truncate">{c.title}</p>
                        <p className="text-[9px] text-muted font-mono">{c.startTime}</p>
                      </div>
                    ))}

                    {/* Tasks */}
                    {day.tasks.map((t: any) => (
                      <div
                        key={t.id}
                        className={`p-1.5 rounded text-[10px] border transition-colors ${
                          t.status === 'COMPLETED'
                            ? 'bg-sage/20 border-sage/40 line-through text-muted'
                            : 'bg-paper border-border-light text-charcoal'
                        }`}
                        title={`${t.title} (${t.estimatedDuration}m)`}
                      >
                        <p className="font-medium truncate">{t.title}</p>
                        <p className="text-[9px] text-muted font-mono">
                          {t.scheduledStartTime || `${t.estimatedDuration}m`}
                        </p>
                      </div>
                    ))}

                    {day.commitments.length === 0 && day.tasks.length === 0 && (
                      <div className="py-6 text-center text-[10px] text-muted-light">
                        Free day
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        /* TIMELINE VIEW */
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-charcoal">Chronological Day Flow</h2>
              <p className="text-xs text-muted">Continuous sequence of activities with recovery buffers</p>
            </div>
            <span className="text-xs text-muted font-mono">{timeline.length} Scheduled Blocks</span>
          </div>

          {timeline.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No activities in timeline"
              description="Click 'Generate Plan' to compile a conflict-free schedule, or add tasks manually."
              action={
                <Button size="sm" icon={Sparkles} onClick={() => setShowGenerateModal(true)}>
                  Generate Plan
                </Button>
              }
            />
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-light">
              {timeline.map((item: any, idx: number) => {
                const isCommitment = item.type === 'COMMITMENT';
                const isCompleted = item.status === 'COMPLETED';

                return (
                  <div key={item.id || idx} className="relative flex items-start gap-3">
                    {/* Timeline bullet */}
                    <div
                      className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 bg-paper ${
                        isCommitment
                          ? 'border-olive bg-olive'
                          : isCompleted
                          ? 'border-sage bg-sage'
                          : 'border-charcoal'
                      }`}
                    />

                    <div
                      className={`flex-1 p-3 rounded-lg border transition-all ${
                        isCommitment
                          ? 'bg-beige/30 border-beige/60 text-charcoal'
                          : isCompleted
                          ? 'bg-sage/15 border-sage/40 text-muted'
                          : 'bg-paper border-border-light text-charcoal'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-charcoal">
                            {item.startTime} – {item.endTime}
                          </span>
                          <span className="font-medium text-sm">{item.title}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-border-light text-muted">
                            {item.category}
                          </span>
                        </div>
                        {item.type === 'TASK' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTask(item.id, item.status)}
                              className="text-xs font-medium text-olive hover:underline"
                            >
                              {isCompleted ? 'Mark Pending' : 'Mark Done'}
                            </button>
                            <button
                              onClick={(e) => handleDeleteTask(item.id, item.title, e)}
                              className="p-1 rounded text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors"
                              title={`Delete "${item.title}"`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      {item.type === 'TASK' && item.details?.personalGoal && (
                        <p className="text-[11px] text-olive mt-1">
                          Goal rotation: {item.details.personalGoal.name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Generate Schedule Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-charcoal flex items-center gap-1.5">
                <Sparkles size={16} className="text-olive" />
                Adaptive Daily Plan Generator
              </h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-muted hover:text-charcoal">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted">
              LifeOS will deterministically calculate conflict-free slots around your wake-up time, lock your fixed classes, insert meals, prioritize urgent tasks, and preserve breaks.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">
                  Today's Wake-Up Time
                </label>
                <input
                  type="time"
                  value={genWakeUp}
                  onChange={(e) => setGenWakeUp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm font-mono text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
                <span className="text-[11px] text-muted-light mt-0.5 block">
                  Planning horizon will automatically adapt (16h waking block).
                </span>
              </div>

              <div className="pt-2 border-t border-border-light">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-charcoal">
                  <input
                    type="checkbox"
                    checked={hasUnavailWindow}
                    onChange={(e) => setHasUnavailWindow(e.target.checked)}
                    className="rounded border-border text-olive focus:ring-olive"
                  />
                  I have an unavailable window today (e.g. Doctor, Gym, Outing)
                </label>

                {hasUnavailWindow && (
                  <div className="mt-3 p-3 rounded-lg bg-ivory space-y-2 border border-border-light">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-muted mb-0.5">Start</label>
                        <input
                          type="time"
                          value={unavailStart}
                          onChange={(e) => setUnavailStart(e.target.value)}
                          className="w-full px-2 py-1 rounded border border-border-light text-xs font-mono bg-paper"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-muted mb-0.5">End</label>
                        <input
                          type="time"
                          value={unavailEnd}
                          onChange={(e) => setUnavailEnd(e.target.value)}
                          className="w-full px-2 py-1 rounded border border-border-light text-xs font-mono bg-paper"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted mb-0.5">Reason</label>
                      <input
                        type="text"
                        placeholder="e.g. Doctor Appointment"
                        value={unavailReason}
                        onChange={(e) => setUnavailReason(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-border-light text-xs bg-paper"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-light">
              <Button variant="ghost" size="sm" onClick={() => setShowGenerateModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleGenerateSchedule} disabled={isGenerating}>
                {isGenerating ? 'Calculating Invariants...' : 'Generate Conflict-Free Plan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modify Schedule Modal */}
      {showModifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-charcoal flex items-center gap-1.5">
                <SlidersHorizontal size={16} className="text-olive" />
                Reschedule Around Unexpected Block
              </h3>
              <button onClick={() => setShowModifyModal(false)} className="text-muted hover:text-charcoal">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-muted">
              Got called into an unexpected meeting or need to leave unexpectedly? Enter the unavailable window and LifeOS will smoothly move affected study blocks to free evening hours.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">Start Time</label>
                  <input
                    type="time"
                    value={unavailStart}
                    onChange={(e) => setUnavailStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm font-mono text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal mb-1">End Time</label>
                  <input
                    type="time"
                    value={unavailEnd}
                    onChange={(e) => setUnavailEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm font-mono text-charcoal"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Unexpected team sync"
                  value={unavailReason}
                  onChange={(e) => setUnavailReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-light">
              <Button variant="ghost" size="sm" onClick={() => setShowModifyModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleModifySchedule} disabled={isGenerating}>
                {isGenerating ? 'Rescheduling...' : 'Apply Rescheduling'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-md w-full p-5">
            <h3 className="text-base font-semibold text-charcoal mb-4">
              {editingTask ? 'Edit Task' : 'Add Task to Planner'}
            </h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete COA Assignment"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>

              {subjects.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Subject (Optional)</label>
                  <select
                    value={taskSubjectId}
                    onChange={(e) => setTaskSubjectId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  >
                    <option value="">No subject linked</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={taskScheduledDate}
                    onChange={(e) => setTaskScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Deadline Date (Optional)</label>
                  <input
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  >
                    <option value="DEADLINE">Deadline Task</option>
                    <option value="PERSONAL_GROWTH">Personal Growth</option>
                    <option value="HEALTH">Health & Break</option>
                    <option value="FLEXIBLE">Flexible</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Start Time (Optional)</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted -mt-2">
                Tip: Leave Start Time blank for flexible/unslotted (<span className="font-mono">--:--</span>), or specify a time (e.g. 17:00) to pin it.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingTask(null);
                    setShowAddModal(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  {editingTask ? 'Update Task' : 'Save Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
