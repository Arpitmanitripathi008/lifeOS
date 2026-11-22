import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Calendar, Plus, CheckCircle2, Circle, Clock, Sparkles, RotateCcw, Trash2, Pencil } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { api, getLocalDateString } from '../../services/api';

export function TodayTimeline() {
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [undoing, setUndoing] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('DEADLINE');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newDuration, setNewDuration] = useState(45);
  const [newStartTime, setNewStartTime] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newScheduledDate, setNewScheduledDate] = useState(() => getLocalDateString());
  const [newDeadline, setNewDeadline] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  const loadSchedule = () => {
    setLoading(true);
    api.getDaySchedule()
      .then((data) => setSchedule(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    api.getSubjects()
      .then((subs) => setSubjects(subs))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const handleToggleTask = async (task: any) => {
    const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    await api.updateTask(task.id, { status: nextStatus });
    loadSchedule();
  };

  const handleEditTask = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setNewTitle(task.title || '');
    setNewCategory(task.category || 'DEADLINE');
    setNewPriority(task.priority || 'MEDIUM');
    setNewDuration(task.estimatedDuration || 45);
    setNewStartTime(task.startTime || task.scheduledStartTime || '');
    setNewScheduledDate(task.scheduledDate || schedule?.date || getLocalDateString());
    setNewDeadline(task.deadline || '');
    setNewSubjectId(task.subjectId || '');
    setShowAddModal(true);
  };

  const handleDeleteTask = async (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete task "${task.title}"?`)) {
      try {
        await api.deleteTask(task.id);
        loadSchedule();
      } catch (err: any) {
        alert(err.message || 'Error deleting task');
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const today = getLocalDateString();
    const payload = {
      title: newTitle,
      category: newCategory,
      priority: newPriority,
      estimatedDuration: Number(newDuration),
      scheduledDate: newScheduledDate || today,
      scheduledStartTime: newStartTime || null,
      deadline: newDeadline || null,
      subjectId: newSubjectId || null,
    };

    if (editingTask) {
      await api.updateTask(editingTask.id, payload);
    } else {
      await api.createTask(payload);
    }

    setEditingTask(null);
    setNewTitle('');
    setNewStartTime('');
    setNewDeadline('');
    setNewSubjectId('');
    setShowAddModal(false);
    loadSchedule();
  };

  const handleUndoOverride = async () => {
    if (!schedule?.date) return;
    setUndoing(true);
    try {
      await api.undoScheduleOverride(schedule.date);
      loadSchedule();
    } catch (err) {
      console.error('Error undoing override:', err);
    } finally {
      setUndoing(false);
    }
  };

  const timelineItems = schedule?.timeline || [];
  const activeOverride = schedule?.activeOverride;
  const isWeeklyHoliday = schedule?.isWeeklyHoliday;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-charcoal">Today's Schedule</h2>
          <p className="text-xs text-muted">Fixed commitments and flexible tasks</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          onClick={() => {
            setEditingTask(null);
            setNewTitle('');
            setNewStartTime('');
            setNewDeadline('');
            setNewSubjectId('');
            setShowAddModal(true);
          }}
        >
          Add Task
        </Button>
      </div>

      {/* Temporary Holiday Override Banner */}
      {activeOverride && (
        <div className="mb-4 p-3.5 rounded-xl bg-sage/30 border border-sage/60 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-olive-dark">
            <div className="w-7 h-7 rounded-lg bg-olive/15 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-olive" />
            </div>
            <div>
              <p className="font-semibold text-charcoal">
                {activeOverride.overrideType === 'HALF_DAY'
                  ? 'Half-Day College Schedule Active'
                  : activeOverride.overrideType === 'CUSTOM_HOURS'
                  ? `Modified College Hours (${activeOverride.adjustedStartTime} – ${activeOverride.adjustedEndTime})`
                  : 'Temporary College Holiday Active'}
              </p>
              <p className="text-muted text-[11px]">
                {activeOverride.overrideType === 'HALF_DAY'
                  ? 'College commitment shortened for today. Weekly schedule remains intact.'
                  : 'College commitment temporarily removed. Your regular weekly timetable is preserved.'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            disabled={undoing}
            className="text-terracotta hover:bg-terracotta/10 shrink-0 text-xs font-medium"
            onClick={handleUndoOverride}
          >
            {undoing ? 'Restoring...' : 'Undo Holiday Override'}
          </Button>
        </div>
      )}

      {/* Regular Weekly Holiday Notice */}
      {!activeOverride && isWeeklyHoliday && (
        <div className="mb-4 p-2.5 rounded-xl bg-beige/40 border border-beige/60 text-xs text-charcoal flex items-center gap-2">
          <Calendar size={15} className="text-olive shrink-0" />
          <span>Weekly holiday schedule: College commitments are automatically excluded.</span>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-muted">Loading schedule...</div>
      ) : timelineItems.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No items scheduled for today"
          description="Tell LifeOS about your day using the AI input above, or add a task manually."
          action={
            <Button size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>
              Add Task
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {timelineItems.map((item: any) => {
            const isCommitment = item.type === 'COMMITMENT';
            const isCompleted = item.status === 'COMPLETED';

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isCommitment
                    ? 'bg-beige/30 border-beige text-charcoal'
                    : isCompleted
                    ? 'bg-sage/20 border-sage/40 opacity-75'
                    : 'bg-paper border-border-light hover:border-border'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isCommitment ? (
                    <div className="w-5 h-5 rounded-full bg-olive/10 flex items-center justify-center shrink-0">
                      <Clock size={12} className="text-olive" />
                    </div>
                  ) : (
                    <button
                      onClick={() => handleToggleTask(item)}
                      className="text-muted hover:text-olive transition-colors shrink-0"
                    >
                      {isCompleted ? (
                        <CheckCircle2 size={18} className="text-olive" />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                  )}

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCompleted ? 'line-through text-muted' : 'text-charcoal'
                      }`}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted flex items-center gap-1 font-mono">
                        <Clock size={10} />
                        {item.startTime} – {item.endTime}
                      </span>
                      {item.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sage/30 text-olive-dark font-medium">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isCommitment ? (
                    <span className="text-[10px] uppercase font-semibold text-muted tracking-wider bg-beige/60 px-2 py-0.5 rounded">
                      Fixed
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={(e) => handleEditTask(item, e)}
                        className="p-1 rounded text-muted hover:text-olive hover:bg-olive/10 transition-colors"
                        title={`Edit "${item.title}"`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTask(item, e)}
                        className="p-1 rounded text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors"
                        title={`Delete "${item.title}"`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-charcoal/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-paper rounded-2xl max-w-md w-full p-6 shadow-xl border border-border-light">
            <h3 className="text-base font-semibold text-charcoal mb-4">
              {editingTask ? 'Edit Task' : 'Add Task'}
            </h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-charcoal mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Complete COA Assignment"
                  className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
                />
              </div>

              {subjects.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Subject (Optional)</label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
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
                  <label className="block text-xs font-semibold text-charcoal mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={newScheduledDate}
                    onChange={(e) => setNewScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Deadline Date (Optional)</label>
                  <input
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
                  >
                    <option value="DEADLINE">Deadline</option>
                    <option value="PERSONAL_GROWTH">Personal Growth</option>
                    <option value="FLEXIBLE">Flexible</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
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
                  <label className="block text-xs font-semibold text-charcoal mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    min={15}
                    step={15}
                    className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal mb-1">Start Time (Optional)</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-ivory/50 border border-border-light rounded-lg text-sm focus:outline-none focus:border-olive"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted -mt-2">
                Tip: Leave Start Time blank to keep task flexible (<span className="font-mono">--:--</span>), or enter a time (e.g. 17:00) to pin it to your timeline.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-light">
                <Button variant="ghost" size="sm" type="button" onClick={() => {
                  setEditingTask(null);
                  setShowAddModal(false);
                }}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  {editingTask ? 'Update Task' : 'Save Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
