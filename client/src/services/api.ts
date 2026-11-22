// LifeOS API Client
import { getLocalDateString, getLocalTimeString, getClientTimezone } from '../utils/date';

export { getLocalDateString, getLocalTimeString, getClientTimezone };

const API_BASE = (import.meta.env.VITE_API_URL ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, '') : '') + '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('lifeos_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('lifeos_token', token);
  } else {
    localStorage.removeItem('lifeos_token');
  }
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const clientHeaders: Record<string, string> = {
    'x-client-date': getLocalDateString(),
    'x-client-time': getLocalTimeString(),
    'x-client-timezone': getClientTimezone(),
    'x-timezone-offset': String(new Date().getTimezoneOffset()),
  };

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...clientHeaders,
      ...authHeaders,
      ...options?.headers,
    },
    ...options,
  });

  if (res.status === 401) {
    // If not calling auth endpoints, notify auth context to log out
    if (!url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      window.dispatchEvent(new CustomEvent('lifeos:unauthorized'));
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// 0. Auth Types & Methods
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  profile?: UserProfile;
}

// 1. Profile / Settings
export interface UserProfile {
  id: string;
  userId?: string;
  displayName: string;
  collegeStartTime: string | null;
  collegeEndTime: string | null;
  breakfastTime: string | null;
  lunchTime: string | null;
  dinnerTime: string | null;
  defaultTaskDuration: number;
  weeklyHolidays?: string | null;
  weeklyCollegeTimings?: string | null;
}

export const api = {
  // Auth
  login: (data: { username: string; password: string }) =>
    fetchJSON<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  register: (data: { fullName: string; username: string; email: string; password: string }) =>
    fetchJSON<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMe: () => fetchJSON<{ user: User; profile: UserProfile }>('/auth/me'),
  logout: () =>
    fetchJSON<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  // Profile
  getProfile: () => fetchJSON<UserProfile>('/profile'),
  updateProfile: (data: Partial<UserProfile>) =>
    fetchJSON<UserProfile>('/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // 2. Commitments
  getCommitments: () => fetchJSON<any[]>('/commitments'),
  createCommitment: (data: any) =>
    fetchJSON<any>('/commitments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCommitment: (id: string) =>
    fetchJSON<void>(`/commitments/${id}`, { method: 'DELETE' }),

  // 3. Tasks
  getTasks: (params?: { date?: string; status?: string; category?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJSON<any[]>(`/tasks${query ? `?${query}` : ''}`);
  },
  createTask: (data: any) =>
    fetchJSON<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTask: (id: string, data: any) =>
    fetchJSON<any>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTask: (id: string) =>
    fetchJSON<void>(`/tasks/${id}`, { method: 'DELETE' }),

  // 4. Academics
  getSubjects: () => fetchJSON<any[]>('/academics/subjects'),
  createSubject: (data: any) =>
    fetchJSON<any>('/academics/subjects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSubject: (id: string, data: any) =>
    fetchJSON<any>(`/academics/subjects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteSubject: (id: string) =>
    fetchJSON<void>(`/academics/subjects/${id}`, { method: 'DELETE' }),
  addUnit: (subjectId: string, data: any) =>
    fetchJSON<any>(`/academics/subjects/${subjectId}/units`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUnit: (id: string, data: any) =>
    fetchJSON<any>(`/academics/units/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteUnit: (id: string) =>
    fetchJSON<void>(`/academics/units/${id}`, { method: 'DELETE' }),
  addTopic: (unitId: string, data: any) =>
    fetchJSON<any>(`/academics/units/${unitId}/topics`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTopic: (id: string, data: any) =>
    fetchJSON<any>(`/academics/topics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTopic: (id: string) =>
    fetchJSON<void>(`/academics/topics/${id}`, { method: 'DELETE' }),
  toggleTopic: (id: string) =>
    fetchJSON<any>(`/academics/topics/${id}/toggle`, { method: 'PATCH' }),
  getExams: () => fetchJSON<any[]>('/academics/exams'),
  createExam: (data: any) =>
    fetchJSON<any>('/academics/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteExam: (id: string) =>
    fetchJSON<void>(`/academics/exams/${id}`, { method: 'DELETE' }),
  getAssignments: () => fetchJSON<any[]>('/academics/assignments'),
  createAssignment: (data: any) =>
    fetchJSON<any>('/academics/assignments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAssignment: (id: string, data: any) =>
    fetchJSON<any>(`/academics/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteAssignment: (id: string) =>
    fetchJSON<void>(`/academics/assignments/${id}`, { method: 'DELETE' }),

  // 5. Personal Goals
  getGoals: () => fetchJSON<any[]>('/goals'),
  createGoal: (data: any) =>
    fetchJSON<any>('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  logGoalSession: (id: string, data: any) =>
    fetchJSON<any>(`/goals/${id}/log-session`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 6. Sleep
  getSleepStats: () => fetchJSON<any>('/sleep/stats'),
  logSleep: (data: any) =>
    fetchJSON<any>('/sleep', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 7. Focus
  getFocusSessions: (date?: string) =>
    fetchJSON<any[]>(`/focus${date ? `?date=${date}` : ''}`),
  logFocus: (data: any) =>
    fetchJSON<any>('/focus', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 8. Reviews
  getReview: (date: string) => fetchJSON<any>(`/reviews/${date}`),
  submitReview: (data: any) =>
    fetchJSON<any>('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 9. Day Schedule & Adaptive Scheduling Engine
  getDaySchedule: (date?: string) =>
    fetchJSON<any>(`/schedule/day?date=${date || getLocalDateString()}`),
  getWeekSchedule: (startDate?: string) =>
    fetchJSON<any>(`/schedule/week?startDate=${startDate || getLocalDateString()}`),
  generateSchedule: (data: {
    date?: string;
    wakeUpTime?: string;
    unavailableWindows?: Array<{ startTime: string; endTime: string; reason?: string }>;
  }) =>
    fetchJSON<any>('/schedule/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  modifySchedule: (data: {
    date?: string;
    unavailableStart: string;
    unavailableEnd: string;
    reason?: string;
  }) =>
    fetchJSON<any>('/schedule/modify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  declareScheduleOverride: (data: {
    date: string;
    overrideType?: string;
    adjustedStartTime?: string | null;
    adjustedEndTime?: string | null;
    reason?: string | null;
  }) =>
    fetchJSON<any>('/schedule/override', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  undoScheduleOverride: (date: string) =>
    fetchJSON<any>('/schedule/override/undo', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
  getScheduleOverride: (date: string) =>
    fetchJSON<{ override: any }>(`/schedule/override/${date}`),

  // 10. Insights
  getInsightsSummary: () => fetchJSON<any>('/insights/summary'),

  // 11. AI Services
  getAIStatus: () =>
    fetchJSON<{
      configured: boolean;
      model: string;
      connected: boolean;
      message: string;
      latencyMs?: number;
    }>('/ai/status'),
  sendAICommand: (prompt: string, context?: { clientDate?: string; clientTime?: string; timezone?: string }) =>
    fetchJSON<{
      success: boolean;
      intent: string;
      explanation: string;
      extractedSleep: any;
      proposal: any;
      tasksCount: number;
    }>('/ai/command', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        clientDate: context?.clientDate || getLocalDateString(),
        clientTime: context?.clientTime || getLocalTimeString(),
        timezone: context?.timezone || getClientTimezone(),
      }),
    }),
  breakdownGoalAI: (data: { goalName: string; category?: string; targetWeeks?: number }) =>
    fetchJSON<any>('/ai/breakdown-goal', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  requestCarryForwardAI: (date?: string) =>
    fetchJSON<any>('/ai/carry-forward', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
  transcribeAudio: (data: { audioBase64: string; mimeType?: string }) =>
    fetchJSON<{ transcript: string }>('/ai/transcribe-audio', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getProposals: (params?: { status?: string; targetDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJSON<any[]>(`/proposals${query ? `?${query}` : ''}`);
  },
  acceptProposal: (id: string) =>
    fetchJSON<any>(`/proposals/${id}/accept`, { method: 'PATCH' }),
  rejectProposal: (id: string) =>
    fetchJSON<any>(`/proposals/${id}/reject`, { method: 'PATCH' }),

  // 12. Academic Document Intelligence
  uploadDocument: async (file: File, docCategory = 'SYLLABUS') => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docCategory', docCategory);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed: ${res.statusText}`);
    }
    return res.json();
  },
  getDocuments: () => fetchJSON<any[]>('/documents'),
  getDocument: (id: string) => fetchJSON<any>(`/documents/${id}`),
  deleteDocument: (id: string) => fetchJSON<void>(`/documents/${id}`, { method: 'DELETE' }),
  commitDocument: (id: string, data: any) =>
    fetchJSON<any>(`/documents/${id}/commit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  generateStudyPlan: (data: { subjectId: string; examId?: string; targetExamDate?: string }) =>
    fetchJSON<any>('/academics/study-plan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 13. Workspace & Data Management
  getWorkspaceResetPreview: (mode: 'CLEAR_MOCK_DATA' | 'RESET_WORKSPACE' = 'CLEAR_MOCK_DATA') =>
    fetchJSON<any>(`/workspace/reset-preview?mode=${mode}`),
  executeWorkspaceReset: (mode: 'CLEAR_MOCK_DATA' | 'RESET_WORKSPACE', confirm = true) =>
    fetchJSON<any>('/workspace/reset', {
      method: 'POST',
      body: JSON.stringify({ mode, confirm }),
    }),
};
