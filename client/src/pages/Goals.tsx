import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Target, Plus, Flame, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { api } from '../services/api';

export function Goals() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('CODING');
  const [prefSessions, setPrefSessions] = useState(3);
  const [duration, setDuration] = useState(45);
  const [description, setDescription] = useState('');

  const loadGoals = () => {
    setLoading(true);
    api.getGoals()
      .then((data) => setGoals(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await api.createGoal({
      name,
      category,
      description: description || null,
      prefSessionsPerWeek: Number(prefSessions),
      sessionDurationMins: Number(duration),
    });

    setName('');
    setDescription('');
    setShowAddModal(false);
    loadGoals();
  };

  const handleLogSession = async (goalId: string) => {
    await api.logGoalSession(goalId, {
      isCompleted: true,
      durationMins: 45,
    });
    loadGoals();
  };

  const totalSessionsCompleted = goals.reduce(
    (acc, g) => acc + (g.goalSessions?.filter((s: any) => s.isCompleted)?.length || 0),
    0
  );

  const totalSessionsTarget = goals.reduce(
    (acc, g) => acc + (g.prefSessionsPerWeek || 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Personal Goals"
        subtitle="Track and schedule your personal growth activities"
        action={
          <Button icon={Plus} size="sm" onClick={() => setShowAddModal(true)}>
            Add Goal
          </Button>
        }
      />

      {/* Weekly summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sage/40 flex items-center justify-center">
              <Target size={18} className="text-olive" />
            </div>
            <div>
              <p className="text-lg font-semibold text-charcoal">{goals.length}</p>
              <p className="text-[11px] text-muted">Active Goals</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-terracotta/10 flex items-center justify-center">
              <Flame size={18} className="text-terracotta" />
            </div>
            <div>
              <p className="text-lg font-semibold text-charcoal">
                {totalSessionsCompleted} / {totalSessionsTarget}
              </p>
              <p className="text-[11px] text-muted">Sessions Logged</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-beige flex items-center justify-center">
              <TrendingUp size={18} className="text-muted" />
            </div>
            <div>
              <p className="text-lg font-semibold text-charcoal">
                {totalSessionsTarget > 0
                  ? `${Math.min(Math.round((totalSessionsCompleted / totalSessionsTarget) * 100), 100)}%`
                  : '—'}
              </p>
              <p className="text-[11px] text-muted">Goal Consistency</p>
            </div>
          </div>
        </Card>
      </div>

      {loading ? (
        <Card>
          <div className="py-12 text-center text-sm text-muted">Loading goals...</div>
        </Card>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No personal goals yet"
          description="Add non-deadline interests like Python, reading, or finance. LifeOS protects scheduled time for them."
          action={
            <Button icon={Plus} size="sm" onClick={() => setShowAddModal(true)}>
              Create Your First Goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const completedCount = g.goalSessions?.filter((s: any) => s.isCompleted)?.length || 0;
            return (
              <Card key={g.id}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-beige text-muted uppercase font-bold tracking-wider">
                      {g.category}
                    </span>
                    <h3 className="text-base font-semibold text-charcoal mt-1">{g.name}</h3>
                    {g.description && <p className="text-xs text-muted mt-0.5">{g.description}</p>}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={CheckCircle}
                    onClick={() => handleLogSession(g.id)}
                  >
                    Log Session
                  </Button>
                </div>

                <div className="pt-3 border-t border-border-light flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-olive" />
                    <span>{g.sessionDurationMins} min per session</span>
                  </div>
                  <span className="font-semibold text-charcoal">
                    {completedCount} / {g.prefSessionsPerWeek} sessions this week
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-md w-full p-5">
            <h3 className="text-base font-semibold text-charcoal mb-4">Add Personal Growth Goal</h3>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Learn Python for AI"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                >
                  <option value="CODING">Coding / Technical</option>
                  <option value="FINANCE">Personal Finance</option>
                  <option value="HOBBY">Reading / Hobby</option>
                  <option value="FITNESS">Fitness & Health</option>
                  <option value="ACADEMIC_EXTRA">Academic Extra</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Weekly Sessions Target</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={prefSessions}
                    onChange={(e) => setPrefSessions(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Session Duration (min)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Why is this important to you?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Goal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
