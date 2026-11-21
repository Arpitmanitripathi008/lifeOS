import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';

type SessionType = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';

export function Focus() {
  const [sessionType, setSessionType] = useState<SessionType>('FOCUS');
  const [duration, setDuration] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  const durationPresets: Record<SessionType, number[]> = {
    FOCUS: [25, 45, 60, 90],
    SHORT_BREAK: [5, 10],
    LONG_BREAK: [15, 20, 30],
  };

  const loadData = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const [sessionsData, tasksData] = await Promise.all([
        api.getFocusSessions(today),
        api.getTasks({ date: today, status: 'PENDING' }),
      ]);
      setSessions(sessionsData);
      setAvailableTasks(tasksData);
      if (tasksData.length > 0 && !selectedTaskId) {
        setSelectedTaskId(tasksData[0].id);
      }
    } catch (err) {
      console.error('Error loading focus data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const switchType = (type: SessionType) => {
    if (isRunning) return;
    setSessionType(type);
    const defaultDur = type === 'FOCUS' ? 25 : type === 'SHORT_BREAK' ? 5 : 15;
    setDuration(defaultDur);
    setTimeLeft(defaultDur * 60);
  };

  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused, duration]);

  const handleSessionComplete = async () => {
    setIsRunning(false);
    setIsPaused(false);

    try {
      await api.logFocus({
        taskId: sessionType === 'FOCUS' && selectedTaskId ? selectedTaskId : null,
        durationMinutes: duration,
        sessionType,
      });

      // Optionally mark linked task as completed if it was a focus session
      if (sessionType === 'FOCUS' && selectedTaskId) {
        const linkedTask = availableTasks.find((t) => t.id === selectedTaskId);
        if (linkedTask && confirm(`Focus session finished! Would you like to mark "${linkedTask.title}" as completed in your schedule?`)) {
          await api.updateTask(selectedTaskId, { status: 'COMPLETED' });
        }
      }

      setSuccessToast(`✓ ${sessionType.replace(/_/g, ' ')} (${duration}m) recorded successfully!`);
      setTimeout(() => setSuccessToast(null), 4000);
      setTimeLeft(duration * 60);
      loadData();
    } catch (err: any) {
      alert(`Error logging focus session: ${err.message}`);
    }
  };

  const handleStart = () => {
    setTimeLeft(duration * 60);
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(duration * 60);
  };

  const handleEndEarly = async () => {
    if (confirm('Are you sure you want to end this session early? The elapsed minutes can be logged.')) {
      const elapsedMinutes = Math.max(1, Math.round((duration * 60 - timeLeft) / 60));
      setIsRunning(false);
      setIsPaused(false);

      if (elapsedMinutes >= 5) {
        await api.logFocus({
          taskId: sessionType === 'FOCUS' && selectedTaskId ? selectedTaskId : null,
          durationMinutes: elapsedMinutes,
          sessionType,
        });
        setSuccessToast(`✓ Recorded partial session (${elapsedMinutes}m).`);
        setTimeout(() => setSuccessToast(null), 4000);
      }
      setTimeLeft(duration * 60);
      loadData();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalFocusMinutes = sessions
    .filter((s) => s.sessionType === 'FOCUS')
    .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  const selectedTask = availableTasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Focus Mode"
        subtitle="Distraction-free focus sessions linked to your curriculum and planned tasks"
      />

      {successToast && (
        <div className="p-3.5 rounded-lg bg-sage/30 border border-sage/60 text-xs text-olive-dark font-medium flex items-center justify-between">
          <span>{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="text-muted hover:text-charcoal">
            ✕
          </button>
        </div>
      )}

      <div className="max-w-xl mx-auto space-y-4">
        <Card className="text-center p-6">
          {/* Mode Tabs */}
          <div className="flex items-center justify-center gap-1 mb-5 bg-beige-light rounded-lg p-1 w-fit mx-auto">
            <button
              onClick={() => switchType('FOCUS')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sessionType === 'FOCUS'
                  ? 'bg-paper text-charcoal shadow-xs font-semibold'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              Focus Session
            </button>
            <button
              onClick={() => switchType('SHORT_BREAK')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sessionType === 'SHORT_BREAK'
                  ? 'bg-paper text-charcoal shadow-xs font-semibold'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              Short Break (5m)
            </button>
            <button
              onClick={() => switchType('LONG_BREAK')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                sessionType === 'LONG_BREAK'
                  ? 'bg-paper text-charcoal shadow-xs font-semibold'
                  : 'text-muted hover:text-charcoal'
              }`}
            >
              Long Break (15m)
            </button>
          </div>

          {/* Connect Session to Task */}
          {sessionType === 'FOCUS' && (
            <div className="mb-6 max-w-sm mx-auto">
              <label className="block text-[11px] font-medium text-muted mb-1 text-left">
                Target Task for this Session:
              </label>
              <select
                disabled={isRunning}
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border-light bg-ivory text-xs text-charcoal font-medium disabled:opacity-75 truncate"
              >
                <option value="">General Focus (No linked task)</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.estimatedDuration}m)
                  </option>
                ))}
              </select>
              {selectedTask && (
                <p className="text-[10px] text-olive text-left mt-1 font-mono">
                  Linked: {selectedTask.category} • Priority: {selectedTask.priority}
                </p>
              )}
            </div>
          )}

          {/* Circular Timer Display */}
          <div className="py-4">
            <div
              className={`w-52 h-52 mx-auto rounded-full border-4 flex flex-col items-center justify-center mb-6 relative transition-colors ${
                sessionType === 'FOCUS'
                  ? 'border-olive bg-sage/10'
                  : 'border-beige bg-ivory/60'
              }`}
            >
              <span className="text-5xl font-light text-charcoal tracking-wider font-mono">
                {formatTime(timeLeft)}
              </span>
              <span className="text-[11px] text-muted font-medium uppercase tracking-wider mt-1">
                {sessionType.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Duration presets */}
            {!isRunning && (
              <div className="flex items-center justify-center gap-2 mb-6">
                {durationPresets[sessionType].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDuration(d);
                      setTimeLeft(d * 60);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      duration === d
                        ? 'bg-olive text-paper font-semibold shadow-xs'
                        : 'bg-beige-light text-muted hover:text-charcoal'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            )}

            {/* Timer Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              {!isRunning ? (
                <Button icon={Play} size="lg" onClick={handleStart}>
                  Start Session
                </Button>
              ) : isPaused ? (
                <>
                  <Button icon={Play} size="md" onClick={handleResume}>
                    Resume
                  </Button>
                  <Button variant="secondary" icon={RotateCcw} size="md" onClick={handleReset}>
                    Reset
                  </Button>
                  <Button variant="danger" icon={Square} size="md" onClick={handleEndEarly}>
                    Stop
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" icon={Pause} size="md" onClick={handlePause}>
                    Pause
                  </Button>
                  <Button variant="danger" icon={Square} size="md" onClick={handleEndEarly}>
                    Stop Early
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Direct Session Complete Shortcut */}
          <div className="border-t border-border-light pt-3 flex items-center justify-between text-xs text-muted">
            <span className="font-mono">
              Today: <strong className="text-charcoal">{totalFocusMinutes} mins</strong> focused
            </span>
            <button
              onClick={handleSessionComplete}
              className="text-olive hover:underline font-medium flex items-center gap-1"
            >
              <CheckCircle2 size={13} />
              Log {duration}m directly
            </button>
          </div>
        </Card>

        {/* Today's Focus Session History */}
        <Card>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-border-light">
            <h3 className="text-sm font-semibold text-charcoal">Today's Focus Log</h3>
            <span className="text-xs text-muted font-mono">{sessions.length} Recorded</span>
          </div>

          {sessions.length === 0 ? (
            <p className="text-xs text-muted-light italic text-center py-4">
              No focus sessions logged today yet. Start a session above to record focused time.
            </p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-ivory text-xs border border-border-light"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2
                      size={15}
                      className={s.sessionType === 'FOCUS' ? 'text-olive shrink-0' : 'text-muted shrink-0'}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal truncate">
                        {s.task?.title || (s.sessionType === 'FOCUS' ? 'Deep Focus Session' : s.sessionType.replace(/_/g, ' '))}
                      </p>
                      <p className="text-[10px] text-muted font-mono">
                        {new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-semibold text-charcoal shrink-0 ml-2">
                    {s.durationMinutes}m
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
