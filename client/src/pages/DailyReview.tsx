import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import {
  ClipboardCheck,
  CheckCircle2,
  CircleDot,
  ArrowRight,
  Ban,
  Sparkles,
  AlertCircle,
  X,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';

export function DailyReview() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskStatuses, setTaskStatuses] = useState<
    Record<
      string,
      {
        status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'POSTPONED' | 'CANCELLED';
        remainingDuration?: number;
        postponedReason?: string;
      }
    >
  >({});
  const [summaryNotes, setSummaryNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Carry-Forward Proposal state
  const [carryForwardProposal, setCarryForwardProposal] = useState<any>(null);
  const [isApprovingProposal, setIsApprovingProposal] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadReviewData = async () => {
    setLoading(true);
    try {
      const [tasksData, reviewData] = await Promise.all([
        api.getTasks({ date: today }),
        api.getReview(today),
      ]);

      setTasks(tasksData);
      const initialMap: any = {};
      for (const t of tasksData) {
        initialMap[t.id] = {
          status: t.status === 'COMPLETED' ? 'COMPLETED' : t.status === 'CANCELLED' ? 'CANCELLED' : t.status === 'POSTPONED' ? 'POSTPONED' : 'COMPLETED',
          remainingDuration: t.remainingDuration || Math.max(15, Math.round(t.estimatedDuration / 2)),
          postponedReason: t.postponedReason || '',
        };
      }
      setTaskStatuses(initialMap);

      if (reviewData?.review) {
        setSubmitted(true);
        setSummaryNotes(reviewData.review.summaryNotes || '');
      }

      if (reviewData?.pendingProposal) {
        setCarryForwardProposal(reviewData.pendingProposal);
      }
    } catch (err) {
      console.error('Error loading daily review:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviewData();
  }, [today]);

  const setStatus = (
    taskId: string,
    status: 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'POSTPONED' | 'CANCELLED'
  ) => {
    setTaskStatuses((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        status,
      },
    }));
  };

  const setRemaining = (taskId: string, remainingDuration: number) => {
    setTaskStatuses((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        remainingDuration,
      },
    }));
  };

  const setReason = (taskId: string, postponedReason: string) => {
    setTaskStatuses((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        postponedReason,
      },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const taskUpdates = Object.entries(taskStatuses).map(([id, val]) => ({
        id,
        status: val.status,
        remainingDuration: val.status === 'PARTIALLY_COMPLETED' ? Number(val.remainingDuration) : null,
        postponedReason: val.postponedReason || null,
      }));

      const res = await api.submitReview({
        date: today,
        summaryNotes,
        taskUpdates,
      });

      setSubmitted(true);
      if (res.proposal) {
        setCarryForwardProposal(res.proposal);
        setSuccessMessage('✓ Daily review submitted! Smart carry-forward plan generated below.');
      } else {
        setSuccessMessage('✓ Daily review saved! Great job wrapping up your day.');
      }
      setTimeout(() => setSuccessMessage(null), 5000);
      loadReviewData();
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveCarryForward = async () => {
    if (!carryForwardProposal?.id) return;
    setIsApprovingProposal(true);
    try {
      await api.acceptProposal(carryForwardProposal.id);
      setCarryForwardProposal(null);
      setSuccessMessage('✓ Carry-forward approved! Tasks have been rescheduled in your planner.');
      setTimeout(() => setSuccessMessage(null), 5000);
      loadReviewData();
    } catch (err: any) {
      alert(`Carry-forward approval failed: ${err.message}`);
    } finally {
      setIsApprovingProposal(false);
    }
  };

  const handleDismissCarryForward = async () => {
    if (!carryForwardProposal?.id) return;
    try {
      await api.rejectProposal(carryForwardProposal.id);
      setCarryForwardProposal(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Parse proposal data if available
  let parsedProposalData: any = null;
  if (carryForwardProposal?.proposalData) {
    try {
      parsedProposalData = JSON.parse(carryForwardProposal.proposalData);
    } catch {
      parsedProposalData = null;
    }
  }

  // Count current review statuses
  const counts = Object.values(taskStatuses).reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Review & Smart Carry-Forward"
        subtitle="Reflect on your progress, record partial work, and intelligently reschedule unfinished tasks without tomorrow overload"
      />

      {/* Success banner */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-sage/30 border border-sage/60 text-xs text-olive-dark font-medium flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-muted hover:text-charcoal">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Status Summary Pill Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl border border-border-light bg-paper flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sage/20 text-olive">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="text-[11px] text-muted">Completed</p>
            <p className="text-base font-semibold text-charcoal">{counts['COMPLETED'] || 0}</p>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border-light bg-paper flex items-center gap-3">
          <div className="p-2 rounded-lg bg-beige text-terracotta">
            <CircleDot size={18} />
          </div>
          <div>
            <p className="text-[11px] text-muted">Partially Done</p>
            <p className="text-base font-semibold text-charcoal">{counts['PARTIALLY_COMPLETED'] || 0}</p>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border-light bg-paper flex items-center gap-3">
          <div className="p-2 rounded-lg bg-beige-light text-muted">
            <ArrowRight size={18} />
          </div>
          <div>
            <p className="text-[11px] text-muted">Postponed</p>
            <p className="text-base font-semibold text-charcoal">{counts['POSTPONED'] || 0}</p>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border-light bg-paper flex items-center gap-3">
          <div className="p-2 rounded-lg bg-ivory text-muted-light">
            <Ban size={18} />
          </div>
          <div>
            <p className="text-[11px] text-muted">Cancelled</p>
            <p className="text-base font-semibold text-charcoal">{counts['CANCELLED'] || 0}</p>
          </div>
        </div>
      </div>

      {/* Smart Carry-Forward Proposal Preview Card */}
      {carryForwardProposal && parsedProposalData && (
        <Card className="border-olive/40 bg-paper">
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-border-light">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-olive/15 text-olive">
                  Smart Carry-Forward Proposal
                </span>
                <span className="flex items-center gap-1 text-[11px] text-olive font-medium">
                  <ShieldCheck size={13} />
                  Burnout Protected & Distributed
                </span>
              </div>
              <p className="text-xs text-charcoal font-medium mt-1">
                {parsedProposalData.analysis || carryForwardProposal.explanation}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={handleDismissCarryForward}>
                Dismiss
              </Button>
              <Button
                size="sm"
                icon={CheckCircle2}
                disabled={isApprovingProposal}
                onClick={handleApproveCarryForward}
              >
                {isApprovingProposal ? 'Applying...' : 'Approve & Apply Plan'}
              </Button>
            </div>
          </div>

          {/* Repeatedly postponed warning */}
          {parsedProposalData.repeatedlyPostponedTasks?.length > 0 && (
            <div className="my-3 p-2.5 rounded bg-terracotta/10 border border-terracotta/30 text-xs text-terracotta flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Repeatedly Postponed Tasks Identified:</span>
                <p className="text-[11px] text-muted mt-0.5">
                  {parsedProposalData.repeatedlyPostponedTasks.map((t: any) => `"${t.title}" (${t.timesPostponed}x postponed)`).join(', ')}. LifeOS has prioritized splitting or spacing these tasks to unblock your momentum.
                </p>
              </div>
            </div>
          )}

          {/* Overflow warning */}
          {parsedProposalData.overflowWarning && (
            <div className="my-3 p-2.5 rounded bg-beige/50 border border-beige text-xs text-charcoal">
              <span className="font-semibold text-olive-dark">Capacity Optimization: </span>
              <span className="text-muted">{parsedProposalData.overflowWarning}</span>
            </div>
          )}

          {/* Recommendations List */}
          <div className="mt-3 space-y-2">
            <h4 className="text-xs font-semibold text-charcoal uppercase tracking-wider">
              Rescheduled Future Slots
            </h4>
            {parsedProposalData.recommendations?.map((rec: any, idx: number) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border border-border-light bg-ivory text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-semibold text-olive bg-sage/30 px-2 py-0.5 rounded">
                    {rec.targetDate}
                  </span>
                  <span className="font-medium text-charcoal">{rec.taskTitle}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-border-light text-muted">
                    {rec.recommendedAction.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-[11px] text-muted-dark">{rec.reason}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <Card>
          <div className="py-16 text-center text-sm text-muted">Loading today's tasks...</div>
        </Card>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No tasks scheduled for today"
          description="When you add or generate tasks for the day, they will appear here for your evening check-in and carry-forward analysis."
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-light">
            <div>
              <h3 className="text-sm font-semibold text-charcoal">Today's Task Assessment</h3>
              <p className="text-xs text-muted">
                Mark tasks as completed, partially done, postponed with a reason, or cancelled.
              </p>
            </div>
            <span className="text-xs font-mono text-muted">{tasks.length} Total Planned</span>
          </div>

          <div className="space-y-3">
            {tasks.map((t) => {
              const currentStatus = taskStatuses[t.id]?.status || 'COMPLETED';
              const currentReason = taskStatuses[t.id]?.postponedReason || '';
              const currentRemaining = taskStatuses[t.id]?.remainingDuration || 30;
              const isRepeatedlyPostponed = t.timesPostponed >= 2;

              return (
                <div
                  key={t.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    currentStatus === 'COMPLETED'
                      ? 'bg-sage/10 border-sage/40'
                      : currentStatus === 'PARTIALLY_COMPLETED'
                      ? 'bg-beige/25 border-beige'
                      : currentStatus === 'POSTPONED'
                      ? 'bg-paper border-border-light'
                      : 'bg-ivory/50 border-border-light opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-charcoal">{t.title}</span>
                        {isRepeatedlyPostponed && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-terracotta/15 text-terracotta">
                            Postponed {t.timesPostponed}x
                          </span>
                        )}
                        {t.category === 'PERSONAL_GROWTH' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider bg-olive/15 text-olive">
                            Growth
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted font-mono mt-0.5">
                        Duration: {t.estimatedDuration}m • Scheduled: {t.scheduledStartTime || 'Flexible'}
                      </p>
                    </div>

                    {/* 4 Status Selector Buttons */}
                    <div className="flex items-center gap-1.5 bg-ivory p-1 rounded-lg border border-border-light">
                      <button
                        type="button"
                        onClick={() => setStatus(t.id, 'COMPLETED')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          currentStatus === 'COMPLETED'
                            ? 'bg-sage text-olive-dark font-bold shadow-xs'
                            : 'text-muted hover:text-charcoal'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        Done
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatus(t.id, 'PARTIALLY_COMPLETED')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          currentStatus === 'PARTIALLY_COMPLETED'
                            ? 'bg-beige text-terracotta font-bold shadow-xs'
                            : 'text-muted hover:text-charcoal'
                        }`}
                      >
                        <CircleDot size={13} />
                        Partial
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatus(t.id, 'POSTPONED')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          currentStatus === 'POSTPONED'
                            ? 'bg-paper text-charcoal font-bold border border-border shadow-xs'
                            : 'text-muted hover:text-charcoal'
                        }`}
                      >
                        <ArrowRight size={13} />
                        Postpone
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatus(t.id, 'CANCELLED')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                          currentStatus === 'CANCELLED'
                            ? 'bg-border-light text-muted-dark font-bold line-through'
                            : 'text-muted hover:text-charcoal'
                        }`}
                      >
                        <Ban size={13} />
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* Partially Completed Details */}
                  {currentStatus === 'PARTIALLY_COMPLETED' && (
                    <div className="mt-3 pt-3 border-t border-border-light/60 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-muted font-medium">Remaining work to complete:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="10"
                          step="5"
                          value={currentRemaining}
                          onChange={(e) => setRemaining(t.id, Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded border border-border-light bg-paper text-xs font-mono text-charcoal"
                        />
                        <span className="text-muted font-mono">minutes</span>
                      </div>
                      <span className="text-[11px] text-olive font-medium">
                        Will be carried forward into an upcoming focused window
                      </span>
                    </div>
                  )}

                  {/* Postponed Details */}
                  {currentStatus === 'POSTPONED' && (
                    <div className="mt-3 pt-3 border-t border-border-light/60 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-muted font-medium">Reason for postponing:</span>
                      <select
                        value={currentReason}
                        onChange={(e) => setReason(t.id, e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-border-light bg-paper text-xs text-charcoal"
                      >
                        <option value="">Select reason...</option>
                        <option value="Ran out of time">Ran out of time</option>
                        <option value="Task was more difficult than expected">More difficult than expected</option>
                        <option value="Unexpected commitments">Unexpected commitments</option>
                        <option value="Changed priorities">Changed priorities</option>
                        <option value="Energy level low">Energy level low</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Or custom explanation..."
                        value={currentReason}
                        onChange={(e) => setReason(t.id, e.target.value)}
                        className="flex-1 min-w-[12rem] px-2.5 py-1 rounded-lg border border-border-light bg-paper text-xs text-charcoal"
                      />
                    </div>
                  )}

                  {/* Cancelled Notice */}
                  {currentStatus === 'CANCELLED' && (
                    <p className="mt-2 text-[11px] text-muted italic">
                      Cancelled tasks are permanently removed from scheduling consideration and will not be carried forward.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reflection Notes */}
          <div className="mt-5 pt-4 border-t border-border-light">
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Daily Reflection Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="How did today go? What worked well, and what should adjust tomorrow?"
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30 resize-none"
            />
          </div>

          {/* Action Row */}
          <div className="mt-5 pt-4 border-t border-border-light flex items-center justify-between">
            {submitted ? (
              <span className="text-xs text-olive font-medium flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Today's review is recorded in database
              </span>
            ) : (
              <span className="text-xs text-muted">
                Submitting updates completion records and triggers Smart Carry-Forward analysis.
              </span>
            )}

            <Button
              size="sm"
              icon={Sparkles}
              disabled={isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Evaluating Carry-Forward...' : submitted ? 'Update Review & Re-analyze' : 'Submit Review'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
