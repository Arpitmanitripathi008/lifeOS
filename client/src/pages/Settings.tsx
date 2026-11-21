import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { User, Clock, Calendar, Zap, Save, Check, RotateCcw, Trash2, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { api } from '../services/api';

const WEEKDAYS = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 0, label: 'Sunday' },
];

function SettingGroup({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: any;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-sage/40 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={18} className="text-olive" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-charcoal">{title}</h3>
          <p className="text-xs text-muted">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export function Settings() {
  const [profile, setProfile] = useState<any>({
    displayName: 'Student',
    collegeStartTime: '09:00',
    collegeEndTime: '15:00',
    breakfastTime: '08:00',
    lunchTime: '13:00',
    dinnerTime: '20:00',
    defaultTaskDuration: 45,
    weeklyHolidays: '[0]',
    weeklyCollegeTimings: '{}',
  });

  const [holidays, setHolidays] = useState<number[]>([0]); // 0 = Sunday
  const [customTimings, setCustomTimings] = useState<Record<string, { start: string; end: string }>>({});
  const [enableCustomDays, setEnableCustomDays] = useState(false);

  const [aiStatus, setAiStatus] = useState<any>({ configured: false, model: 'gemini-flash-lite-latest', message: 'Checking...' });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Data Reset & Workspace Management States
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'CLEAR_MOCK_DATA' | 'RESET_WORKSPACE'>('CLEAR_MOCK_DATA');
  const [resetPreview, setResetPreview] = useState<any>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetExecuting, setResetExecuting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const handleOpenResetModal = async (mode: 'CLEAR_MOCK_DATA' | 'RESET_WORKSPACE') => {
    setResetMode(mode);
    setResetModalOpen(true);
    setResetLoading(true);
    setResetSuccessMessage(null);
    try {
      const preview = await api.getWorkspaceResetPreview(mode);
      setResetPreview(preview);
    } catch (err: any) {
      console.error(err);
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetExecuting(true);
    try {
      const res = await api.executeWorkspaceReset(resetMode, true);
      setResetSuccessMessage(res.message);
      setResetModalOpen(false);
      setResetPreview(null);
    } catch (err: any) {
      alert(err.message || 'Error executing reset');
    } finally {
      setResetExecuting(false);
    }
  };

  useEffect(() => {
    api.getProfile()
      .then((p) => {
        if (p) {
          setProfile(p);
          if (p.weeklyHolidays) {
            try {
              setHolidays(JSON.parse(p.weeklyHolidays));
            } catch {}
          }
          if (p.weeklyCollegeTimings) {
            try {
              const parsed = JSON.parse(p.weeklyCollegeTimings);
              setCustomTimings(parsed);
              if (Object.keys(parsed).length > 0) {
                setEnableCustomDays(true);
              }
            } catch {}
          }
        }
      })
      .catch((err) => console.error(err));

    api.getAIStatus()
      .then((status) => setAiStatus(status))
      .catch(() => {});
  }, []);

  const toggleHoliday = (day: number) => {
    if (holidays.includes(day)) {
      setHolidays(holidays.filter((d) => d !== day));
    } else {
      setHolidays([...holidays, day]);
    }
  };

  const handleCustomTimingChange = (day: number, field: 'start' | 'end', value: string) => {
    setCustomTimings((prev) => ({
      ...prev,
      [String(day)]: {
        start: field === 'start' ? value : prev[String(day)]?.start || profile.collegeStartTime || '09:00',
        end: field === 'end' ? value : prev[String(day)]?.end || profile.collegeEndTime || '15:00',
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        displayName: profile.displayName,
        collegeStartTime: profile.collegeStartTime,
        collegeEndTime: profile.collegeEndTime,
        breakfastTime: profile.breakfastTime,
        lunchTime: profile.lunchTime,
        dinnerTime: profile.dinnerTime,
        defaultTaskDuration: Number(profile.defaultTaskDuration),
        weeklyHolidays: JSON.stringify(holidays),
        weeklyCollegeTimings: JSON.stringify(enableCustomDays ? customTimings : {}),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your profile, weekly timetable, routines, and preferences"
        action={
          <Button
            icon={savedSuccess ? Check : Save}
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : savedSuccess ? 'Saved!' : 'Save Changes'}
          </Button>
        }
      />

      <div className="max-w-2xl">
        <SettingGroup
          icon={User}
          title="Profile"
          description="Your display name and personal information"
        >
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Display Name</label>
            <input
              type="text"
              value={profile.displayName || ''}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              placeholder="Enter your name"
              className="px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal w-full focus:outline-none focus:ring-2 focus:ring-olive/30"
            />
          </div>
        </SettingGroup>

        <SettingGroup
          icon={Clock}
          title="Daily Routine & Protected Meals"
          description="Set your typical meal times — the scheduler protects these and never overlaps tasks"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Breakfast</label>
              <input
                type="time"
                value={profile.breakfastTime || '08:00'}
                onChange={(e) => setProfile({ ...profile, breakfastTime: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal w-full focus:outline-none focus:ring-2 focus:ring-olive/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Lunch</label>
              <input
                type="time"
                value={profile.lunchTime || '13:00'}
                onChange={(e) => setProfile({ ...profile, lunchTime: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal w-full focus:outline-none focus:ring-2 focus:ring-olive/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Dinner</label>
              <input
                type="time"
                value={profile.dinnerTime || '20:00'}
                onChange={(e) => setProfile({ ...profile, dinnerTime: e.target.value })}
                className="px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal w-full focus:outline-none focus:ring-2 focus:ring-olive/30"
              />
            </div>
          </div>
        </SettingGroup>

        {/* Weekly Timetable & College Hours */}
        <SettingGroup
          icon={Calendar}
          title="Weekly Timetable & College Hours"
          description="Configure your recurring weekly schedule, weekly holidays, and individual weekday timings"
        >
          <div className="space-y-4">
            {/* Default hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Standard College Starts</label>
                <input
                  type="time"
                  value={profile.collegeStartTime || '09:00'}
                  onChange={(e) => setProfile({ ...profile, collegeStartTime: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal w-full focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Standard College Ends</label>
                <input
                  type="time"
                  value={profile.collegeEndTime || '15:00'}
                  onChange={(e) => setProfile({ ...profile, collegeEndTime: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal w-full focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>
            </div>

            {/* Weekly Holidays Selection */}
            <div className="pt-2 border-t border-border-light">
              <label className="block text-xs font-semibold text-charcoal mb-2">
                Recurring Weekly Holidays (College is excluded on these days)
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((w) => {
                  const isHoliday = holidays.includes(w.day);
                  return (
                    <button
                      key={w.day}
                      type="button"
                      onClick={() => toggleHoliday(w.day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        isHoliday
                          ? 'bg-sage text-olive-dark border-olive font-semibold'
                          : 'bg-paper text-muted border-border-light hover:border-border'
                      }`}
                    >
                      {isHoliday ? `✓ ${w.label} (Holiday)` : w.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted mt-1.5">
                Sunday is configured as a weekly holiday by default. The scheduler automatically excludes college commitments on chosen holidays.
              </p>
            </div>

            {/* Different schedules for different weekdays toggle */}
            <div className="pt-2 border-t border-border-light">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-charcoal">Different Schedule for Specific Weekdays</p>
                  <p className="text-[11px] text-muted">Customize college hours for days that differ from your standard timing</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableCustomDays}
                  onChange={(e) => setEnableCustomDays(e.target.checked)}
                  className="w-4 h-4 rounded text-olive focus:ring-olive"
                />
              </div>

              {enableCustomDays && (
                <div className="space-y-2.5 bg-ivory/50 p-3 rounded-xl border border-border-light">
                  {WEEKDAYS.filter((w) => !holidays.includes(w.day)).map((w) => {
                    const dayKey = String(w.day);
                    const timing = customTimings[dayKey] || {
                      start: profile.collegeStartTime || '09:00',
                      end: profile.collegeEndTime || '15:00',
                    };

                    return (
                      <div key={w.day} className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-charcoal w-24">{w.label}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={timing.start}
                            onChange={(e) => handleCustomTimingChange(w.day, 'start', e.target.value)}
                            className="px-2 py-1 bg-paper border border-border-light rounded text-xs"
                          />
                          <span className="text-muted">to</span>
                          <input
                            type="time"
                            value={timing.end}
                            onChange={(e) => handleCustomTimingChange(w.day, 'end', e.target.value)}
                            className="px-2 py-1 bg-paper border border-border-light rounded text-xs"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SettingGroup>

        <SettingGroup
          icon={Zap}
          title="Backend & Persistence Status"
          description="Database and API connection indicator"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-sage/20 rounded-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-olive animate-pulse" />
              <span className="text-xs text-olive-dark font-medium">
                Backend API & SQLite Database: Connected (Port 3001)
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-beige-light rounded-lg">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  aiStatus.connected
                    ? 'bg-olive animate-pulse'
                    : aiStatus.configured
                    ? 'bg-beige-dark'
                    : 'bg-terracotta'
                }`}
              />
              <div className="text-xs">
                <span className="font-semibold text-charcoal">
                  Google Gemini ({aiStatus.model}):{' '}
                </span>
                <span className={aiStatus.connected ? 'text-olive-dark font-medium' : 'text-muted'}>
                  {aiStatus.connected
                    ? 'Connected & Operational'
                    : aiStatus.configured
                    ? aiStatus.message
                    : 'API Key not set in server/.env'}
                </span>
              </div>
            </div>
          </div>
        </SettingGroup>

        {/* Workspace & Data Management */}
        <SettingGroup
          icon={RotateCcw}
          title="Workspace & Data Management"
          description="Erase demo and mock data or reset your workspace to a clean state for your real academic schedule"
        >
          {resetSuccessMessage && (
            <div className="mb-4 p-3 rounded-lg bg-sage/30 border border-sage text-xs text-olive-dark flex items-center gap-2">
              <CheckCircle2 size={16} className="text-olive shrink-0" />
              <span>{resetSuccessMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mode A: Clear Mock Data */}
            <div className="p-4 rounded-xl border border-border-light bg-ivory/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trash2 size={16} className="text-olive" />
                  <h4 className="text-sm font-semibold text-charcoal">Mode A: Clear Demo & Mock Data</h4>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Removes seeded sample subjects (OS, DBMS, Networks), demo syllabus topics, exams, and sample tasks.
                  <strong className="text-charcoal block mt-1">Preserves your real data, user login, and settings.</strong>
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs font-medium"
                onClick={() => handleOpenResetModal('CLEAR_MOCK_DATA')}
              >
                Preview & Clear Mock Data
              </Button>
            </div>

            {/* Mode B: Reset Entire Workspace */}
            <div className="p-4 rounded-xl border border-border-light bg-ivory/50 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={16} className="text-terracotta" />
                  <h4 className="text-sm font-semibold text-charcoal">Mode B: Reset Entire Workspace</h4>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Clears all workspace records (academics, goals, tasks, sleep logs, focus sessions, reviews).
                  <strong className="text-charcoal block mt-1">Preserves your login account and routine configuration.</strong>
                </p>
              </div>
              <Button
                size="sm"
                className="w-full text-xs font-medium bg-terracotta hover:bg-terracotta/90 text-paper"
                onClick={() => handleOpenResetModal('RESET_WORKSPACE')}
              >
                Preview & Reset Workspace
              </Button>
            </div>
          </div>
        </SettingGroup>
      </div>

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-xs">
          <div className="bg-paper border border-border-light rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    resetMode === 'RESET_WORKSPACE' ? 'bg-terracotta/15 text-terracotta' : 'bg-sage/40 text-olive'
                  }`}
                >
                  {resetMode === 'RESET_WORKSPACE' ? <AlertTriangle size={18} /> : <Trash2 size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-charcoal">
                    {resetMode === 'RESET_WORKSPACE' ? 'Reset Entire Workspace' : 'Clear Demo & Mock Data'}
                  </h3>
                  <p className="text-xs text-muted">
                    {resetMode === 'RESET_WORKSPACE'
                      ? 'Mode B: Full workspace initialization'
                      : 'Mode A: Targeted demo record cleanup'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResetModalOpen(false)}
                className="text-muted hover:text-charcoal p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {resetLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted">
                <Loader2 size={24} className="animate-spin text-olive" />
                <span>Auditing workspace records...</span>
              </div>
            ) : resetPreview ? (
              <div className="space-y-3.5 text-xs">
                <p className="text-muted leading-relaxed">{resetPreview.summary}</p>

                {/* Queued Items */}
                <div className="bg-ivory/80 rounded-xl p-3.5 border border-border-light space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border-light font-medium text-charcoal">
                    <span>Records to be permanently deleted:</span>
                    <span className="font-mono text-terracotta font-semibold">
                      {resetPreview.toDelete?.totalItems || 0} items
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-paper p-2 rounded border border-border-light">
                      <span className="text-muted block">Subjects:</span>
                      <span className="font-bold text-charcoal">{resetPreview.toDelete?.subjects || 0}</span>
                    </div>
                    <div className="bg-paper p-2 rounded border border-border-light">
                      <span className="text-muted block">Tasks:</span>
                      <span className="font-bold text-charcoal">{resetPreview.toDelete?.tasks || 0}</span>
                    </div>
                    <div className="bg-paper p-2 rounded border border-border-light">
                      <span className="text-muted block">Goals:</span>
                      <span className="font-bold text-charcoal">{resetPreview.toDelete?.personalGoals || 0}</span>
                    </div>
                    <div className="bg-paper p-2 rounded border border-border-light">
                      <span className="text-muted block">Documents:</span>
                      <span className="font-bold text-charcoal">{resetPreview.toDelete?.documents || 0}</span>
                    </div>
                  </div>

                  {resetPreview.toDelete?.sampleSubjects?.length > 0 && (
                    <p className="text-[11px] text-muted pt-1">
                      <span className="font-medium text-charcoal">Demo Subjects to Delete: </span>
                      {resetPreview.toDelete.sampleSubjects.join(', ')}
                    </p>
                  )}
                </div>

                {/* Preserved guarantees */}
                <div className="bg-sage/20 border border-sage/40 rounded-xl p-3.5 space-y-1.5">
                  <p className="font-semibold text-olive-dark flex items-center gap-1.5 text-xs">
                    <CheckCircle2 size={14} className="text-olive" /> What will remain safe and preserved:
                  </p>
                  <p className="text-[11px] text-charcoal">
                    <strong>Account: </strong> {resetPreview.toPreserve?.userAccount}
                  </p>
                  <p className="text-[11px] text-charcoal">
                    <strong>Routine & Settings: </strong> {resetPreview.toPreserve?.settings}
                  </p>
                  {resetMode === 'CLEAR_MOCK_DATA' && (
                    <p className="text-[11px] text-olive-dark font-medium pt-0.5">
                      ✓ {resetPreview.toPreserve?.explanation} ({resetPreview.toPreserve?.realSubjectsCount || 0} real
                      subjects, {resetPreview.toPreserve?.realTasksCount || 0} real tasks preserved)
                    </p>
                  )}
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    This action deletes selected workspace records from the database. Analytics will be immediately
                    updated to reflect the new state. This action cannot be reversed.
                  </span>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-light">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setResetModalOpen(false)}
                    disabled={resetExecuting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-terracotta hover:bg-terracotta/90 text-paper font-medium"
                    icon={resetExecuting ? Loader2 : CheckCircle2}
                    disabled={resetExecuting}
                    onClick={handleConfirmReset}
                  >
                    {resetExecuting
                      ? 'Executing Reset...'
                      : resetMode === 'RESET_WORKSPACE'
                      ? 'Yes, Reset My Workspace'
                      : 'Yes, Delete Mock Data'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
