import { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ProgressBar } from '../components/ui/ProgressBar';
import {
  GraduationCap,
  Upload,
  Plus,
  BookOpen,
  FileText,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Sparkles,
  AlertCircle,
  Clock,
  Trash2,
  FileCode,
  FileSpreadsheet,
  X,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  ClipboardList,
} from 'lucide-react';
import { api } from '../services/api';

type AcademicTab = 'subjects' | 'exams' | 'assignments' | 'intelligence';

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function Academics() {
  const [tab, setTab] = useState<AcademicTab>('subjects');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showStudyPlanModal, setShowStudyPlanModal] = useState(false);

  // Subject form
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');

  // Assignment form
  const [asgnSubjectId, setAsgnSubjectId] = useState('');
  const [asgnTitle, setAsgnTitle] = useState('');
  const [asgnDeadline, setAsgnDeadline] = useState('');
  const [asgnHours, setAsgnHours] = useState(2);
  const [asgnDescription, setAsgnDescription] = useState('');

  // Upload state
  const [uploadCategory, setUploadCategory] = useState<'SYLLABUS' | 'EXAM_TIMETABLE'>('SYLLABUS');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Review & Correction state
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [isCommitting, setIsCommitting] = useState(false);

  // Study plan state
  const [selectedSubjectForPlan, setSelectedSubjectForPlan] = useState<any>(null);
  const [selectedExamForPlan, setSelectedExamForPlan] = useState<any>(null);
  const [studyPlanProposal, setStudyPlanProposal] = useState<any>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, e, d, a] = await Promise.all([
        api.getSubjects(),
        api.getExams(),
        api.getDocuments(),
        api.getAssignments().catch(() => []),
      ]);
      setSubjects(s);
      setExams(e);
      setDocuments(d);
      setAssignments(a || []);
    } catch (err) {
      console.error('Error loading academic data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleTopic = async (topicId: string) => {
    await api.toggleTopic(topicId);
    loadData();
  };

  const handleDeleteSubject = async (sub: any) => {
    if (window.confirm(`Are you sure you want to delete "${sub.name}"? This will remove its syllabus topics and exams.`)) {
      try {
        await api.deleteSubject(sub.id);
        setSuccessMessage(`Subject "${sub.name}" removed.`);
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } catch (err: any) {
        alert(err.message || 'Error deleting subject');
      }
    }
  };

  const handleDeleteExam = async (exam: any) => {
    if (window.confirm(`Are you sure you want to delete the exam for "${exam.subject?.name || 'this subject'}" on ${exam.examDate}?`)) {
      try {
        await api.deleteExam(exam.id);
        setSuccessMessage('Exam removed.');
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } catch (err: any) {
        alert(err.message || 'Error deleting exam');
      }
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asgnSubjectId || !asgnTitle.trim() || !asgnDeadline) {
      alert('Please fill in Subject, Title, and Deadline date.');
      return;
    }
    try {
      await api.createAssignment({
        subjectId: asgnSubjectId,
        title: asgnTitle.trim(),
        deadline: asgnDeadline,
        estimatedHours: Number(asgnHours) || 2,
        description: asgnDescription.trim() || null,
        status: 'PENDING',
      });
      setAsgnTitle('');
      setAsgnDeadline('');
      setAsgnDescription('');
      setShowAddAssignmentModal(false);
      setSuccessMessage('✓ Assignment added successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating assignment');
    }
  };

  const handleToggleAssignmentStatus = async (asgn: any) => {
    try {
      const nextStatus = asgn.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      await api.updateAssignment(asgn.id, { status: nextStatus });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating assignment');
    }
  };

  const handleDeleteAssignment = async (asgn: any) => {
    if (window.confirm(`Are you sure you want to delete assignment "${asgn.title}"?`)) {
      try {
        await api.deleteAssignment(asgn.id);
        setSuccessMessage('Assignment removed.');
        setTimeout(() => setSuccessMessage(null), 3000);
        loadData();
      } catch (err: any) {
        alert(err.message || 'Error deleting assignment');
      }
    }
  };

  const handleScheduleAssignmentToPlanner = async (asgn: any) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.createTask({
        title: `Complete ${asgn.subject?.name ? asgn.subject.name + ' ' : ''}Assignment: ${asgn.title}`,
        category: 'DEADLINE',
        priority: 'HIGH',
        estimatedDuration: Math.round((asgn.estimatedHours || 2) * 60),
        scheduledDate: today,
        deadline: asgn.deadline,
        subjectId: asgn.subjectId,
        source: 'MANUAL',
      });
      setSuccessMessage('✓ Assignment task added to Today\'s Planner!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error scheduling assignment');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    await api.createSubject({
      name: subjectName,
      code: subjectCode || null,
      colorTag: '#68754C',
    });

    setSubjectName('');
    setSubjectCode('');
    setShowAddSubjectModal(false);
    setSuccessMessage('✓ Subject created successfully');
    setTimeout(() => setSuccessMessage(null), 4000);
    loadData();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validation 1: Size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 10MB.`);
      return;
    }

    // Validation 2: Extension
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`Unsupported file format. Please upload PDF, DOCX, TXT, PNG, JPG, or WEBP.`);
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadDocument(file, uploadCategory);
      if (res.document && res.analysis) {
        setSelectedDoc(res.document);
        setReviewData(res.analysis);
        setShowReviewModal(true);
        setSuccessMessage(`✓ Document analyzed with Gemini! Please review and confirm.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }
      loadData();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload and analyze document');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenReview = (doc: any) => {
    setSelectedDoc(doc);
    try {
      const parsed = typeof doc.parsedData === 'string' ? JSON.parse(doc.parsedData) : doc.parsedData;
      setReviewData(parsed);
      setShowReviewModal(true);
    } catch (e) {
      alert('Could not parse document data');
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.deleteDocument(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCommitReview = async () => {
    if (!selectedDoc || !reviewData) return;

    setIsCommitting(true);
    try {
      await api.commitDocument(selectedDoc.id, {
        documentType: reviewData.documentType || selectedDoc.docCategory,
        syllabus: reviewData.syllabus,
        examTimetable: reviewData.examTimetable,
      });

      setShowReviewModal(false);
      setSelectedDoc(null);
      setReviewData(null);
      setSuccessMessage('✓ Document successfully imported into your curriculum!');
      setTimeout(() => setSuccessMessage(null), 5000);
      loadData();
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleInitiateStudyPlan = async (subject: any, exam?: any) => {
    setSelectedSubjectForPlan(subject);
    setSelectedExamForPlan(exam || subject.exams?.[0] || null);
    setShowStudyPlanModal(true);
    setStudyPlanProposal(null);
  };

  const handleGenerateStudyPlan = async () => {
    if (!selectedSubjectForPlan) return;
    setIsGeneratingPlan(true);
    try {
      const res = await api.generateStudyPlan({
        subjectId: selectedSubjectForPlan.id,
        examId: selectedExamForPlan?.id,
        targetExamDate: selectedExamForPlan?.examDate,
      });

      setStudyPlanProposal(res);
      setSuccessMessage('✓ Adaptive study plan generated! Review below.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleApproveStudyPlan = async () => {
    if (!studyPlanProposal?.proposalId) return;
    try {
      await api.acceptProposal(studyPlanProposal.proposalId);
      setShowStudyPlanModal(false);
      setStudyPlanProposal(null);
      setSuccessMessage('✓ Study plan accepted! Revision tasks added to your planner.');
      setTimeout(() => setSuccessMessage(null), 5000);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const tabs: { id: AcademicTab; label: string; icon: any }[] = [
    { id: 'subjects', label: `Subjects (${subjects.length})`, icon: BookOpen },
    { id: 'exams', label: `Exams (${exams.length})`, icon: CalendarCheck },
    { id: 'assignments', label: `Assignments (${assignments.length})`, icon: ClipboardList },
    { id: 'intelligence', label: `Document Intelligence (${documents.length})`, icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academics"
        subtitle="Syllabus intelligence, topic mastery, and automated exam revision planning"
        action={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Upload}
              onClick={() => {
                setTab('intelligence');
                fileInputRef.current?.click();
              }}
            >
              Upload Document
            </Button>
            {tab === 'assignments' ? (
              <Button size="sm" icon={Plus} onClick={() => setShowAddAssignmentModal(true)}>
                Add Assignment
              </Button>
            ) : (
              <Button size="sm" icon={Plus} onClick={() => setShowAddSubjectModal(true)}>
                Add Subject
              </Button>
            )}
          </div>
        }
      />

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp"
        className="hidden"
      />

      {/* Alerts */}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-sage/30 border border-sage/60 text-xs text-olive-dark font-medium flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-muted hover:text-charcoal">
            <X size={14} />
          </button>
        </div>
      )}

      {uploadError && (
        <div className="p-3.5 rounded-lg bg-terracotta/15 border border-terracotta/40 text-xs text-terracotta font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-muted hover:text-charcoal">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-light">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? 'border-olive text-olive font-semibold'
                : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <div className="py-16 text-center text-sm text-muted">Loading academic data...</div>
        </Card>
      ) : tab === 'subjects' ? (
        /* SUBJECTS TAB */
        subjects.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No subjects added yet"
            description="Add your semester subjects or upload a syllabus document (PDF/DOCX/image) to auto-extract units and topics."
            action={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  icon={Upload}
                  onClick={() => {
                    setTab('intelligence');
                    fileInputRef.current?.click();
                  }}
                >
                  Upload Syllabus
                </Button>
                <Button variant="secondary" icon={Plus} size="sm" onClick={() => setShowAddSubjectModal(true)}>
                  Add Manually
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-4">
            {subjects.map((sub) => {
              const allTopics = sub.units?.flatMap((u: any) => u.topics) || [];
              const completedTopics = allTopics.filter((t: any) => t.isCompleted);
              const progress = allTopics.length > 0 ? Math.round((completedTopics.length / allTopics.length) * 100) : 0;
              const hasExam = sub.exams && sub.exams.length > 0;

              return (
                <Card key={sub.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-charcoal">{sub.name}</h3>
                        {sub.code && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-sage/30 text-olive-dark font-mono font-medium">
                            {sub.code}
                          </span>
                        )}
                        {hasExam && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-terracotta/15 text-terracotta font-medium flex items-center gap-1">
                            <CalendarCheck size={11} />
                            Exam: {sub.exams[0].examDate}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        {completedTopics.length} of {allTopics.length} topics mastered ({progress}%)
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Sparkles}
                        onClick={() => handleInitiateStudyPlan(sub)}
                      >
                        Generate Study Plan
                      </Button>
                      <button
                        onClick={() => handleDeleteSubject(sub)}
                        className="p-1.5 rounded-lg text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors"
                        title={`Delete ${sub.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <ProgressBar value={progress} color="olive" />

                  {/* Units breakdown */}
                  {sub.units && sub.units.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border-light space-y-3">
                      {sub.units.map((unit: any) => (
                        <div key={unit.id} className="bg-ivory/60 rounded-lg p-3">
                          <p className="text-xs font-semibold text-charcoal mb-2">
                            Unit {unit.unitNumber}: {unit.title}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {unit.topics?.map((topic: any) => (
                              <div
                                key={topic.id}
                                onClick={() => handleToggleTopic(topic.id)}
                                className={`flex items-center justify-between p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                                  topic.isCompleted
                                    ? 'bg-sage/15 border-sage/40 text-muted line-through'
                                    : 'bg-paper border-border-light hover:border-olive text-charcoal'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {topic.isCompleted ? (
                                    <CheckCircle2 size={14} className="text-olive shrink-0" />
                                  ) : (
                                    <Circle size={14} className="text-muted shrink-0" />
                                  )}
                                  <span className="truncate">{topic.title}</span>
                                </div>
                                <span className="text-[10px] text-muted-light font-mono ml-2 shrink-0">
                                  {topic.estimatedMinutes}m
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : tab === 'exams' ? (
        /* EXAMS TAB */
        exams.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No exams scheduled"
            description="Upload an examination timetable (PDF, DOCX, or photo) or enter exam dates manually to unlock automated revision schedules."
            action={
              <Button
                size="sm"
                icon={Upload}
                onClick={() => {
                  setTab('intelligence');
                  setUploadCategory('EXAM_TIMETABLE');
                  fileInputRef.current?.click();
                }}
              >
                Upload Exam Timetable
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((ex) => (
              <Card key={ex.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-terracotta bg-terracotta/15 px-2 py-0.5 rounded">
                      Examination
                    </span>
                    <h3 className="text-base font-semibold text-charcoal mt-1.5">{ex.subject?.name}</h3>
                    {ex.subject?.code && (
                      <p className="text-xs font-mono text-muted">{ex.subject.code}</p>
                    )}
                    <div className="mt-2.5 space-y-1 text-xs text-muted">
                      <p className="flex items-center gap-1.5 font-medium text-charcoal">
                        <Calendar size={13} className="text-olive" />
                        {new Intl.DateTimeFormat('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(`${ex.examDate}T00:00:00`))}
                      </p>
                      {ex.startTime && (
                        <p className="flex items-center gap-1.5 font-mono">
                          <Clock size={13} className="text-muted" />
                          {ex.startTime} – {ex.endTime || 'End'}
                        </p>
                      )}
                      {ex.location && (
                        <p className="text-muted-dark">Location: {ex.location}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Sparkles}
                      onClick={() => handleInitiateStudyPlan(ex.subject, ex)}
                    >
                      Plan Revision
                    </Button>
                    <button
                      onClick={() => handleDeleteExam(ex)}
                      className="p-1.5 rounded-lg text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors"
                      title={`Delete exam for ${ex.subject?.name || 'subject'}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : tab === 'assignments' ? (
        /* ASSIGNMENTS TAB */
        assignments.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assignments added"
            description="Track coursework, homework, problem sets, and lab submissions. LifeOS helps you finish them on time while balancing exam preparation."
            action={
              <Button size="sm" icon={Plus} onClick={() => setShowAddAssignmentModal(true)}>
                Add Assignment
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">
                {assignments.filter((a) => a.status === 'COMPLETED').length} of {assignments.length} assignments completed
              </p>
              <Button size="sm" icon={Plus} onClick={() => setShowAddAssignmentModal(true)}>
                Add Assignment
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map((asgn) => {
                const isPastDeadline = new Date(`${asgn.deadline}T23:59:59`) < new Date();
                const isCompleted = asgn.status === 'COMPLETED';

                return (
                  <Card key={asgn.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-olive bg-sage/20 px-2 py-0.5 rounded">
                            {asgn.subject?.name || 'Academic Assignment'}
                          </span>
                          {asgn.subject?.code && (
                            <span className="text-[10px] font-mono text-muted bg-paper px-1.5 py-0.5 rounded border border-border-light">
                              {asgn.subject.code}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              isCompleted
                                ? 'bg-sage/20 text-olive-dark'
                                : isPastDeadline
                                ? 'bg-terracotta/15 text-terracotta'
                                : 'bg-ivory text-charcoal border border-border-light'
                            }`}
                          >
                            {isCompleted ? '✓ Completed' : isPastDeadline ? 'Overdue' : 'Pending'}
                          </span>
                        </div>

                        <h3 className={`text-base font-semibold mt-2 ${isCompleted ? 'line-through text-muted' : 'text-charcoal'}`}>
                          {asgn.title}
                        </h3>

                        {asgn.description && (
                          <p className="text-xs text-muted mt-1 line-clamp-2">{asgn.description}</p>
                        )}

                        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                          <span className="flex items-center gap-1.5 font-medium text-charcoal">
                            <Calendar size={13} className="text-terracotta" />
                            Due: {new Intl.DateTimeFormat('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }).format(new Date(`${asgn.deadline}T00:00:00`))}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock size={13} className="text-muted" />
                            {asgn.estimatedHours}h estimated
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleAssignmentStatus(asgn)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isCompleted
                              ? 'text-olive bg-sage/20 hover:bg-sage/30'
                              : 'text-muted hover:text-olive hover:bg-sage/10'
                          }`}
                          title={isCompleted ? 'Mark as pending' : 'Mark as completed'}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Sparkles}
                          onClick={() => handleScheduleAssignmentToPlanner(asgn)}
                          title="Schedule work block to Today's Planner"
                        >
                          Plan Work
                        </Button>
                        <button
                          onClick={() => handleDeleteAssignment(asgn)}
                          className="p-1.5 rounded-lg text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors"
                          title={`Delete assignment`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )
      ) : (
        /* DOCUMENT INTELLIGENCE TAB */
        <div className="space-y-6">
          {/* Upload Dropzone */}
          <Card>
            <div className="border-2 border-dashed border-border-light rounded-xl p-8 text-center bg-ivory/30 hover:bg-ivory/60 transition-colors">
              <Upload size={32} className="mx-auto mb-3 text-olive" />
              <h3 className="text-sm font-semibold text-charcoal mb-1">
                Upload Syllabus or Examination Timetable
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto mb-4">
                Upload official course PDFs, Word documents (.docx), text files, or photos/scans (.png, .jpg). Gemini will accurately extract subjects, units, topics, and exam dates without hallucinating missing data.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                  <input
                    type="radio"
                    name="uploadCat"
                    checked={uploadCategory === 'SYLLABUS'}
                    onChange={() => setUploadCategory('SYLLABUS')}
                    className="text-olive focus:ring-olive"
                  />
                  Syllabus Document
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
                  <input
                    type="radio"
                    name="uploadCat"
                    checked={uploadCategory === 'EXAM_TIMETABLE'}
                    onChange={() => setUploadCategory('EXAM_TIMETABLE')}
                    className="text-olive focus:ring-olive"
                  />
                  Exam Timetable
                </label>
              </div>

              <Button
                size="sm"
                icon={Upload}
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? 'Analyzing with Gemini...' : 'Choose File to Upload'}
              </Button>
              <p className="text-[11px] text-muted-light mt-2 font-mono">
                Supported: PDF, DOCX, TXT, PNG, JPG, WEBP (Max 10MB)
              </p>
            </div>
          </Card>

          {/* Uploaded Documents List */}
          <Card>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-light">
              <h3 className="text-sm font-semibold text-charcoal">Document Repository</h3>
              <span className="text-xs text-muted font-mono">{documents.length} Uploaded</span>
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">
                No documents uploaded yet. Upload a syllabus or exam schedule to get started.
              </p>
            ) : (
              <div className="divide-y divide-border-light">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="py-3 flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded bg-beige-light text-olive shrink-0">
                        {doc.fileType === 'PDF' ? (
                          <FileText size={18} />
                        ) : doc.fileType === 'DOCX' ? (
                          <FileCode size={18} />
                        ) : doc.fileType === 'IMAGE' ? (
                          <CalendarCheck size={18} />
                        ) : (
                          <FileSpreadsheet size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-charcoal truncate">{doc.fileName}</p>
                        <p className="text-[11px] text-muted font-mono">
                          {doc.fileType} • {(doc.fileSize / 1024).toFixed(0)} KB •{' '}
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                          doc.status === 'PARSED'
                            ? 'bg-sage/30 text-olive-dark'
                            : doc.status === 'PROCESSING'
                            ? 'bg-beige text-charcoal'
                            : 'bg-terracotta/15 text-terracotta'
                        }`}
                      >
                        {doc.status}
                      </span>

                      {doc.parsedData && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenReview(doc)}
                        >
                          Review & Import
                        </Button>
                      )}

                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        className="text-muted hover:text-terracotta p-1 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Extracted Information Review & Correction Modal */}
      {showReviewModal && reviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-light">
              <div>
                <h3 className="text-base font-semibold text-charcoal flex items-center gap-2">
                  <ShieldCheck size={18} className="text-olive" />
                  Review Extracted Academic Intelligence
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Verify or edit extracted curriculum data before saving to your persistent database.
                </p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-muted hover:text-charcoal">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Unclear items banner */}
              {reviewData.unclearItems && reviewData.unclearItems.length > 0 && (
                <div className="p-3 rounded-lg bg-terracotta/10 border border-terracotta/30 text-xs text-terracotta">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <HelpCircle size={14} />
                    Items Needing User Confirmation
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-muted">
                    {reviewData.unclearItems.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Syllabus Review */}
              {reviewData.syllabus && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-charcoal mb-1">Subject Name</label>
                      <input
                        type="text"
                        value={reviewData.syllabus.subjectName || ''}
                        onChange={(e) =>
                          setReviewData({
                            ...reviewData,
                            syllabus: { ...reviewData.syllabus, subjectName: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-border-light bg-ivory text-xs text-charcoal"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-charcoal mb-1">Course Code</label>
                      <input
                        type="text"
                        value={reviewData.syllabus.subjectCode || ''}
                        onChange={(e) =>
                          setReviewData({
                            ...reviewData,
                            syllabus: { ...reviewData.syllabus, subjectCode: e.target.value },
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-border-light bg-ivory text-xs font-mono text-charcoal"
                      />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
                      Extracted Units & Topics ({reviewData.syllabus.units?.length || 0} Units)
                    </h4>
                    <div className="space-y-3">
                      {reviewData.syllabus.units?.map((u: any, uIdx: number) => (
                        <div key={uIdx} className="p-3 rounded-lg bg-ivory border border-border-light space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-olive font-mono">Unit {u.unitNumber}:</span>
                            <input
                              type="text"
                              value={u.title}
                              onChange={(e) => {
                                const newUnits = [...reviewData.syllabus.units];
                                newUnits[uIdx].title = e.target.value;
                                setReviewData({
                                  ...reviewData,
                                  syllabus: { ...reviewData.syllabus, units: newUnits },
                                });
                              }}
                              className="flex-1 px-2 py-1 rounded border border-border-light text-xs font-semibold bg-paper"
                            />
                          </div>

                          <div className="pl-4 space-y-1">
                            {u.topics?.map((top: any, tIdx: number) => (
                              <div key={tIdx} className="flex items-center justify-between text-xs gap-2">
                                <input
                                  type="text"
                                  value={top.title}
                                  onChange={(e) => {
                                    const newUnits = [...reviewData.syllabus.units];
                                    newUnits[uIdx].topics[tIdx].title = e.target.value;
                                    setReviewData({
                                      ...reviewData,
                                      syllabus: { ...reviewData.syllabus, units: newUnits },
                                    });
                                  }}
                                  className="flex-1 px-2 py-0.5 rounded border border-border-light/60 bg-paper text-[11px]"
                                />
                                <span className="font-mono text-[10px] text-muted">{top.estimatedMinutes}m</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Exam Timetable Review */}
              {reviewData.examTimetable && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                    Extracted Examinations ({reviewData.examTimetable.exams?.length || 0} Exams)
                  </h4>
                  <div className="space-y-2">
                    {reviewData.examTimetable.exams?.map((ex: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg bg-ivory border border-border-light grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-muted mb-0.5">Subject</label>
                          <input
                            type="text"
                            value={ex.subjectName}
                            onChange={(e) => {
                              const newExams = [...reviewData.examTimetable.exams];
                              newExams[idx].subjectName = e.target.value;
                              setReviewData({
                                ...reviewData,
                                examTimetable: { ...reviewData.examTimetable, exams: newExams },
                              });
                            }}
                            className="w-full px-2 py-1 rounded border border-border-light text-xs bg-paper font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted mb-0.5">Exam Date (YYYY-MM-DD)</label>
                          <input
                            type="date"
                            value={ex.examDate}
                            onChange={(e) => {
                              const newExams = [...reviewData.examTimetable.exams];
                              newExams[idx].examDate = e.target.value;
                              setReviewData({
                                ...reviewData,
                                examTimetable: { ...reviewData.examTimetable, exams: newExams },
                              });
                            }}
                            className="w-full px-2 py-1 rounded border border-border-light text-xs bg-paper font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-light">
              <Button variant="ghost" size="sm" onClick={() => setShowReviewModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCommitReview} disabled={isCommitting} icon={CheckCircle2}>
                {isCommitting ? 'Importing...' : 'Confirm & Import to Curriculum'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exam Study Plan Generator Modal */}
      {showStudyPlanModal && selectedSubjectForPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col p-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-light">
              <h3 className="text-base font-semibold text-charcoal flex items-center gap-2">
                <Sparkles size={16} className="text-olive" />
                Adaptive Exam Study Plan
              </h3>
              <button onClick={() => setShowStudyPlanModal(false)} className="text-muted hover:text-charcoal">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              <div>
                <p className="text-sm font-semibold text-charcoal">{selectedSubjectForPlan.name}</p>
                <p className="text-xs text-muted">
                  Target Exam Date:{' '}
                  <span className="font-mono font-medium text-charcoal">
                    {selectedExamForPlan?.examDate || 'No date set'}
                  </span>
                </p>
              </div>

              {!studyPlanProposal ? (
                <div className="py-6 text-center space-y-3">
                  <p className="text-xs text-muted max-w-sm mx-auto">
                    LifeOS will calculate the remaining days before your examination and generate a spaced revision plan with mock sessions, respecting your daily study workload.
                  </p>
                  <Button size="sm" onClick={handleGenerateStudyPlan} disabled={isGeneratingPlan} icon={Sparkles}>
                    {isGeneratingPlan ? 'Generating Spaced Plan...' : 'Generate Adaptive Plan'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-charcoal font-medium">{studyPlanProposal.plan?.explanation}</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {studyPlanProposal.plan?.tasks?.map((t: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border border-border-light bg-ivory/60 text-xs flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-charcoal">{t.title}</p>
                          <p className="text-[10px] text-muted font-mono">Date: {t.scheduledDate}</p>
                        </div>
                        <span className="font-mono text-[10px] text-olive font-semibold">{t.durationMinutes}m</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-light">
              <Button variant="ghost" size="sm" onClick={() => setShowStudyPlanModal(false)}>
                Close
              </Button>
              {studyPlanProposal && (
                <Button size="sm" onClick={handleApproveStudyPlan} icon={CheckCircle2}>
                  Approve & Add to Planner
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-md w-full p-5">
            <h3 className="text-base font-semibold text-charcoal mb-4">Add New Subject</h3>
            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operating Systems"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Course Code (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. CS302"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddSubjectModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Subject
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Add Assignment Modal */}
      {showAddAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 backdrop-blur-xs p-4">
          <div className="bg-paper rounded-xl border border-border-light shadow-xl max-w-md w-full p-5">
            <h3 className="text-base font-semibold text-charcoal mb-4">Add New Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Subject</label>
                <select
                  required
                  value={asgnSubjectId}
                  onChange={(e) => setAsgnSubjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Assignment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 1 & 2 Practice Questions"
                  value={asgnTitle}
                  onChange={(e) => setAsgnTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Deadline Date</label>
                  <input
                    type="date"
                    required
                    value={asgnDeadline}
                    onChange={(e) => setAsgnDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Estimated Hours</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    value={asgnHours}
                    onChange={(e) => setAsgnHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Description / Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Solve problems 1-15 from textbook chapter 2"
                  value={asgnDescription}
                  onChange={(e) => setAsgnDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border-light bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-olive/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddAssignmentModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Assignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
