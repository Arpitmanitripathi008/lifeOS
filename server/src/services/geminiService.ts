import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import dotenv from 'dotenv';

export function getGeminiClient(): { ai: GoogleGenAI | null; model: string; error?: string } {
  dotenv.config();

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-flash-lite-latest';

  if (!apiKey) {
    return {
      ai: null,
      model,
      error: 'GEMINI_API_KEY is not configured. Please add your Gemini API key in server/.env.',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: 'v1beta' },
    });
    return { ai, model };
  } catch (err: any) {
    return {
      ai: null,
      model,
      error: `Failed to initialize Gemini client: ${err.message}`,
    };
  }
}

// 1. Natural Language Command Schema
export const CommandResponseSchema = z.object({
  intent: z
    .enum([
      'MORNING_CHECKIN',
      'TIME_UNAVAILABLE',
      'HOLIDAY_DECLARATION',
      'SCHEDULE_OVERRIDE',
      'ADD_TASK',
      'LIGHTER_SCHEDULE',
      'TASK_COMPLETED',
      'GENERAL_INSTRUCTION',
      'CLEAR_MOCK_DATA',
      'RESET_WORKSPACE',
      'DATA_RESET_REQUEST',
    ])
    .default('GENERAL_INSTRUCTION'),
  resetRequest: z
    .object({
      mode: z.enum(['CLEAR_MOCK_DATA', 'RESET_WORKSPACE', 'AMBIGUOUS']).default('CLEAR_MOCK_DATA'),
      reason: z.string().optional(),
    })
    .nullable()
    .optional(),
  holidayDeclaration: z
    .object({
      isHoliday: z.boolean().default(true),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      type: z.enum(['FULL_HOLIDAY', 'HALF_DAY', 'CUSTOM_HOURS', 'CANCEL_CLASSES']).default('FULL_HOLIDAY'),
      adjustedStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
      adjustedEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
      reason: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  extractedSleep: z
    .object({
      bedTimeApprox: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
      wakeUpTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      sleepDurationMinutes: z.number().int().positive().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  unavailableWindow: z
    .object({
      startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      reason: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  tasksToSchedule: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().nullable().optional(),
        category: z.enum(['FIXED', 'DEADLINE', 'PERSONAL_GROWTH', 'HEALTH', 'FLEXIBLE']).default('DEADLINE'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        estimatedDuration: z.number().int().positive().default(45),
        preferredStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
        reason: z.string().optional(),
      })
    )
    .default([]),
  userExplanation: z.string().default(''),
  suggestedScheduleAction: z
    .enum(['CREATE_TASKS', 'REGENERATE_SCHEDULE', 'LOG_SLEEP', 'NO_ACTION', 'APPLY_HOLIDAY', 'PREVIEW_RESET'])
    .default('CREATE_TASKS'),
});

export type CommandResponse = z.infer<typeof CommandResponseSchema>;

// 2. Goal Breakdown Schema
export const GoalBreakdownSchema = z.object({
  goalName: z.string(),
  milestones: z.array(
    z.object({
      unitNumber: z.number().int().positive(),
      title: z.string(),
      topics: z.array(
        z.object({
          title: z.string(),
          estimatedMinutes: z.number().int().positive().default(45),
          difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
        })
      ),
    })
  ),
  recommendedSessionsPerWeek: z.number().int().min(1).max(7),
  recommendedSessionDurationMins: z.number().int().positive(),
  overview: z.string(),
});

export type GoalBreakdown = z.infer<typeof GoalBreakdownSchema>;

// 3. Smart Carry-Forward Schema
export const CarryForwardSchema = z.object({
  analysis: z.string(),
  recommendations: z.array(
    z.object({
      taskId: z.string(),
      taskTitle: z.string(),
      recommendedAction: z.enum([
        'MOVE_TO_TOMORROW',
        'SPLIT_INTO_SMALLER',
        'SLOT_INTO_UPCOMING_DAY',
        'DROP_PRIORITY',
      ]),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      targetStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
      reason: z.string(),
    })
  ),
});

export type CarryForwardResponse = z.infer<typeof CarryForwardSchema>;

export class GeminiService {
  /**
   * Test the live connection to Google Gemini API
   */
  static async testConnection(): Promise<{ success: boolean; model: string; message: string; latencyMs?: number }> {
    const { ai, model, error } = getGeminiClient();
    if (!ai) {
      return { success: false, model, message: error || 'API key not configured' };
    }

    const start = Date.now();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Respond with the single word "Connected" in valid JSON format: {"status":"Connected"}' }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text?.trim() || '';
      return {
        success: true,
        model,
        message: `Successfully connected to Gemini API (${model}). Response: ${text.slice(0, 100)}`,
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        model,
        message: `Gemini API Error: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Process Natural Language user instructions (Morning check-in, schedule changes, holidays, etc.)
   */
  static async processCommand(
    userPrompt: string,
    context?: {
      currentTime?: string;
      profile?: any;
      fixedCommitments?: any[];
      todayTasks?: any[];
      personalGoals?: any[];
      upcomingExams?: any[];
      upcomingAssignments?: any[];
      subjects?: any[];
      todayDate?: string;
      tomorrowDate?: string;
      dayOfWeekName?: string;
    }
  ): Promise<CommandResponse> {
    const { ai, model, error } = getGeminiClient();
    if (!ai) {
      console.warn(`[GeminiService] Gemini client not configured (${error}). Using deterministic fallback.`);
      return fallbackProcessCommand(userPrompt, context, error);
    }

    const todayDate = context?.todayDate || new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = context?.tomorrowDate || tomorrow.toISOString().split('T')[0];

    const systemPrompt = `You are the core intelligence of LifeOS — an AI-powered personal life management system for college students.
Core philosophy: "LifeOS adapts to the user's life. The user does not adapt their life to LifeOS."
Sustainable balance over maximum task exhaustion.

Current Context:
- Current Local Time: ${context?.currentTime || new Date().toLocaleTimeString('en-US', { hour12: false })}
- Today Date: ${todayDate} (${context?.dayOfWeekName || 'Today'})
- Tomorrow Date: ${tomorrowDate}
- User Routine: College ${context?.profile?.collegeStartTime || '09:00'} to ${context?.profile?.collegeEndTime || '15:00'}, Lunch: ${context?.profile?.lunchTime || '13:00'}, Dinner: ${context?.profile?.dinnerTime || '20:00'}
- Fixed Commitments Today: ${JSON.stringify(context?.fixedCommitments || [])}
- Existing Tasks Today: ${JSON.stringify(context?.todayTasks?.map((t) => ({ id: t.id, title: t.title, time: t.scheduledStartTime, status: t.status })) || [])}
- Active Personal Goals: ${JSON.stringify(context?.personalGoals?.map((g) => ({ name: g.name, targetSessions: g.prefSessionsPerWeek })) || [])}
- Upcoming Examinations: ${JSON.stringify(context?.upcomingExams?.map((e: any) => ({ subject: e.subject?.name, code: e.subject?.code, examDate: e.examDate, time: e.startTime })) || [])}
- Upcoming Assignments & Deadlines: ${JSON.stringify(context?.upcomingAssignments?.map((a: any) => ({ subject: a.subject?.name, title: a.title, deadline: a.deadline })) || [])}
- User Subjects: ${JSON.stringify(context?.subjects?.map((s: any) => ({ id: s.id, name: s.name, code: s.code })) || [])}

Rules:
1. HOLIDAY & TIMETABLE OVERRIDE DETECTION:
   - If user states "Today is a holiday", "No college today", "College is cancelled today", "Class cancelled":
     set intent: "HOLIDAY_DECLARATION", set holidayDeclaration: { isHoliday: true, targetDate: "${todayDate}", type: "FULL_HOLIDAY", reason: "User declared holiday" }, suggestedScheduleAction: "APPLY_HOLIDAY".
   - If user states "Tomorrow there will be no college", "No college tomorrow", "Tomorrow is a holiday":
     set intent: "HOLIDAY_DECLARATION", set holidayDeclaration: { isHoliday: true, targetDate: "${tomorrowDate}", type: "CANCEL_CLASSES", reason: "User declared tomorrow holiday" }, suggestedScheduleAction: "APPLY_HOLIDAY".
   - If user states "I have only half-day college today", "Half day today":
     set intent: "SCHEDULE_OVERRIDE", set holidayDeclaration: { isHoliday: true, targetDate: "${todayDate}", type: "HALF_DAY", adjustedStartTime: "09:00", adjustedEndTime: "12:00", reason: "Half-day college" }.
   - If user states "My college timings have changed today to 10:00 to 13:00" or similar:
     set intent: "SCHEDULE_OVERRIDE", set holidayDeclaration: { isHoliday: true, targetDate: "${todayDate}", type: "CUSTOM_HOURS", adjustedStartTime: "10:00", adjustedEndTime: "13:00", reason: "Changed college timings" }.
   - Always state in userExplanation that regular weekly timetable remains preserved.
2. MORNING CHECK-IN:
   - If user gives sleep/wake times (e.g. "I woke up at 7:30 AM and slept around 12:15 AM"), set intent: "MORNING_CHECKIN", extract bedTimeApprox ("00:15") and wakeUpTime ("07:30"), calculate duration in minutes. Never shame sleep.
3. UNAVAILABLE TIME:
   - If user mentions unavailability ("cannot work between 4 PM and 6 PM"), set intent: "TIME_UNAVAILABLE", mark unavailableWindow.
4. TASK CATEGORIES:
   - DEADLINE (assignments, exams, lab prep)
   - PERSONAL_GROWTH (coding, languages, finance, reading, fitness)
   - HEALTH (meals, breaks, rest)
   - FLEXIBLE (errands, optional tasks)
5. DATA RESET & WORKSPACE MANAGEMENT:
   - If user asks to delete mock/sample/demo data (e.g. "Erase all previous mock data", "Clear the demo data", "Remove all sample academic records and tasks", "Delete sample data"):
     set intent: "CLEAR_MOCK_DATA", resetRequest: { mode: "CLEAR_MOCK_DATA", reason: "User requested mock data cleanup" }, suggestedScheduleAction: "PREVIEW_RESET".
   - If user asks to reset their workspace (e.g. "Reset my workspace", "I want to start fresh", "Wipe all my data", "Clear workspace"):
     set intent: "RESET_WORKSPACE", resetRequest: { mode: "RESET_WORKSPACE", reason: "User requested workspace reset" }, suggestedScheduleAction: "PREVIEW_RESET".
   - If ambiguous (e.g. "Reset data", "Clean up data"):
     set intent: "DATA_RESET_REQUEST", resetRequest: { mode: "AMBIGUOUS" }, suggestedScheduleAction: "NO_ACTION".
6. ASSIGNMENTS, DEADLINES & MULTI-DAY EXAM PREPARATION:
   - REAL-TIME CLOCK AWARENESS: Current time is ${context?.currentTime || 'now'}. NEVER schedule tasks or time slots in the past! All proposed tasks for today must start in future hours (after ${context?.currentTime || 'now'}).
   - DEADLINES & EXAM STRATEGY: If user has assignments due soon (e.g., Monday submission) and exams approaching (e.g., Wednesday/Thursday), schedule assignment completion as high priority for tonight and tomorrow so submissions are safely completed before exams begin.
   - Explain your balanced multi-day strategy clearly and encouragingly in userExplanation.

Return JSON matching this shape:
{
  "intent": "MORNING_CHECKIN" | "TIME_UNAVAILABLE" | "HOLIDAY_DECLARATION" | "SCHEDULE_OVERRIDE" | "ADD_TASK" | "LIGHTER_SCHEDULE" | "TASK_COMPLETED" | "GENERAL_INSTRUCTION" | "CLEAR_MOCK_DATA" | "RESET_WORKSPACE" | "DATA_RESET_REQUEST",
  "resetRequest": {
    "mode": "CLEAR_MOCK_DATA" | "RESET_WORKSPACE" | "AMBIGUOUS",
    "reason": "string"
  } | null,
  "holidayDeclaration": {
    "isHoliday": true,
    "targetDate": "YYYY-MM-DD",
    "type": "FULL_HOLIDAY" | "HALF_DAY" | "CUSTOM_HOURS" | "CANCEL_CLASSES",
    "adjustedStartTime": "HH:mm" | null,
    "adjustedEndTime": "HH:mm" | null,
    "reason": "string"
  } | null,
  "extractedSleep": {
    "bedTimeApprox": "HH:mm" | null,
    "wakeUpTime": "HH:mm",
    "sleepDurationMinutes": number | null,
    "notes": "string" | null
  } | null,
  "unavailableWindow": {
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "reason": "string" | null
  } | null,
  "tasksToSchedule": [
    {
      "title": "string",
      "description": "string" | null,
      "category": "DEADLINE" | "PERSONAL_GROWTH" | "HEALTH" | "FLEXIBLE",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      "estimatedDuration": number,
      "preferredStartTime": "HH:mm" | null,
      "reason": "string"
    }
  ],
  "userExplanation": "string",
  "suggestedScheduleAction": "CREATE_TASKS" | "REGENERATE_SCHEDULE" | "LOG_SLEEP" | "NO_ACTION" | "APPLY_HOLIDAY"
}`;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Input: "${userPrompt}"` }] },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const rawText = response.text?.trim() || '{}';
      const parsed = JSON.parse(rawText);
      return CommandResponseSchema.parse(parsed);
    } catch (err: any) {
      console.warn(`[GeminiService] Gemini API call failed (${err.message}). Activating local natural language fallback.`);
      return fallbackProcessCommand(userPrompt, context, err.message);
    }
  }

  /**
   * Break down a personal goal or topic into structured milestones and manageable units
   */
  static async breakdownGoal(
    goalName: string,
    category: string = 'CODING',
    targetWeeks: number = 4
  ): Promise<GoalBreakdown> {
    const { ai, model, error } = getGeminiClient();
    if (!ai) {
      return fallbackBreakdownGoal(goalName, category, targetWeeks);
    }

    const prompt = `You are an expert tutor in LifeOS. Break down this personal goal into a structured, realistic academic roadmap for a student.
Goal: "${goalName}"
Category: "${category}"
Duration: ${targetWeeks} weeks

Return a JSON object matching this schema:
{
  "goalName": "${goalName}",
  "overview": "string summarizing pedagogical structure",
  "recommendedSessionsPerWeek": number (2 to 5),
  "recommendedSessionDurationMins": number (30 to 60),
  "milestones": [
    {
      "unitNumber": number,
      "title": "string",
      "topics": [
        {
          "title": "string",
          "estimatedMinutes": number,
          "difficulty": "EASY" | "MEDIUM" | "HARD"
        }
      ]
    }
  ]
}`;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return GoalBreakdownSchema.parse(parsed);
    } catch (err: any) {
      console.warn('Gemini breakdown error, using fallback:', err.message);
      return fallbackBreakdownGoal(goalName, category, targetWeeks);
    }
  }

  /**
   * Smart Carry-Forward analysis for daily review
   */
  static async smartCarryForward(
    incompleteTasks: any[],
    upcomingScheduleContext: any
  ): Promise<CarryForwardResponse> {
    const { ai, model } = getGeminiClient();
    if (!ai) {
      return fallbackCarryForward(incompleteTasks, upcomingScheduleContext);
    }

    const prompt = `You are the LifeOS Academic Rescheduling Assistant.
Review these incomplete / postponed tasks from today:
${JSON.stringify(incompleteTasks)}

Upcoming Schedule Summary:
${JSON.stringify(upcomingScheduleContext)}

Rules:
1. NEVER automatically reschedule CANCELLED tasks.
2. If a task was postponed >= 2 times, flag it as repeatedly postponed and split it or slot it with buffer.
3. If duration > 60m, consider SPLIT_INTO_SMALLER.
4. Avoid overloading tomorrow. If tomorrow already has >= 300m scheduled, slot into day after tomorrow.
5. Protect student wellbeing.

Return JSON:
{
  "analysis": "string explaining reasoning clearly",
  "recommendations": [
    {
      "taskId": "string",
      "taskTitle": "string",
      "recommendedAction": "MOVE_TO_TOMORROW" | "SPLIT_INTO_SMALLER" | "SLOT_INTO_UPCOMING_DAY" | "DROP_PRIORITY",
      "targetDate": "YYYY-MM-DD",
      "targetStartTime": "HH:mm" or null,
      "reason": "string"
    }
  ]
}`;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return CarryForwardSchema.parse(parsed);
    } catch (err: any) {
      return fallbackCarryForward(incompleteTasks, upcomingScheduleContext);
    }
  }

  /**
   * Transcribe audio using Gemini multimodal audio model
   */
  static async transcribeAudio(
    audioBase64: string,
    mimeType: string = 'audio/webm'
  ): Promise<{ transcript: string }> {
    const { ai, model } = getGeminiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured in server/.env.');
    }

    const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: cleanMime,
                data: audioBase64,
              },
            },
            {
              text: 'You are an accurate audio transcription assistant for LifeOS. Transcribe all spoken words in this audio recording verbatim. Output only the plain transcribed text with no quotes, commentary, or markdown formatting.',
            },
          ],
        },
      ],
    });

    const transcript = response.text?.trim() || '';
    return { transcript };
  }
}

function parseTimeToMinutes(str: string): { hours: number; minutes: number } | null {
  const match = str.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toLowerCase();
  if (period === 'pm' && h < 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return { hours: h, minutes: m };
}

function formatTime(h: number, m: number): string {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function fallbackProcessCommand(
  userPrompt: string,
  context?: any,
  errorMessage?: string
): CommandResponse {
  const today = context?.todayDate || new Date().toISOString().split('T')[0];
  const tomorrowDateObj = new Date();
  tomorrowDateObj.setDate(tomorrowDateObj.getDate() + 1);
  const tomorrow = context?.tomorrowDate || tomorrowDateObj.toISOString().split('T')[0];

  const lower = userPrompt.toLowerCase();
  const isTomorrow = lower.includes('tomorrow');
  const targetDate = isTomorrow ? tomorrow : today;

  // 0. Data Management & Reset Heuristic Detection
  const isMockCleanup =
    lower.includes('mock data') ||
    lower.includes('demo data') ||
    lower.includes('sample academic') ||
    lower.includes('sample records') ||
    lower.includes('erase all previous mock') ||
    lower.includes('clear the demo') ||
    lower.includes('clear demo') ||
    lower.includes('remove all sample') ||
    lower.includes('delete mock') ||
    /(erase|clear|remove|delete)\s+(all\s+)?(previous\s+)?(mock|sample|demo)/i.test(userPrompt);

  const isWorkspaceReset =
    lower.includes('reset my workspace') ||
    lower.includes('reset workspace') ||
    lower.includes('start fresh') ||
    lower.includes('wipe all my data') ||
    lower.includes('wipe data') ||
    lower.includes('wipe workspace') ||
    /(reset\s+(my\s+)?workspace|start\s+fresh|wipe\s+(all\s+)?(my\s+)?data)/i.test(userPrompt);

  const isAmbiguousReset =
    !isMockCleanup &&
    !isWorkspaceReset &&
    (lower.includes('reset data') ||
      lower.includes('clear data') ||
      lower.includes('clean up account') ||
      lower.includes('clean up data'));

  if (isMockCleanup) {
    return {
      intent: 'CLEAR_MOCK_DATA',
      resetRequest: {
        mode: 'CLEAR_MOCK_DATA',
        reason: userPrompt,
      },
      holidayDeclaration: null,
      extractedSleep: null,
      unavailableWindow: null,
      tasksToSchedule: [],
      userExplanation:
        'I detected a request to clear demonstration and mock data. I have compiled a detailed safety preview of sample records that will be deleted and what will be preserved. Review and explicitly confirm below before any changes are made.',
      suggestedScheduleAction: 'PREVIEW_RESET',
    };
  }

  if (isWorkspaceReset) {
    return {
      intent: 'RESET_WORKSPACE',
      resetRequest: {
        mode: 'RESET_WORKSPACE',
        reason: userPrompt,
      },
      holidayDeclaration: null,
      extractedSleep: null,
      unavailableWindow: null,
      tasksToSchedule: [],
      userExplanation:
        'I detected a request to reset your entire workspace to a clean slate. I have prepared a safety preview of records to be cleared. Your login account and essential preferences will be safely preserved. Review and confirm below to proceed.',
      suggestedScheduleAction: 'PREVIEW_RESET',
    };
  }

  if (isAmbiguousReset) {
    return {
      intent: 'DATA_RESET_REQUEST',
      resetRequest: {
        mode: 'AMBIGUOUS',
        reason: userPrompt,
      },
      holidayDeclaration: null,
      extractedSleep: null,
      unavailableWindow: null,
      tasksToSchedule: [],
      userExplanation:
        'You requested a data reset. LifeOS provides two distinct reset modes:\n1. **Mode A (Clear Mock Data)**: Deletes only seeded demonstration subjects, sample exams, goals, and tasks, while preserving your real user data and settings.\n2. **Mode B (Reset Entire Workspace)**: Wipes all workspace records to initialize a clean slate, while keeping your account login and configuration.\n\nPlease specify whether you would like to clear mock data or reset your entire workspace.',
      suggestedScheduleAction: 'NO_ACTION',
    };
  }

  // 1. Holiday & Timetable Override Heuristic Detection
  const isHoliday =
    lower.includes('holiday') ||
    lower.includes('no college') ||
    lower.includes('college is cancelled') ||
    lower.includes('college is canceled') ||
    lower.includes('college cancelled') ||
    lower.includes('college canceled') ||
    lower.includes('no classes') ||
    lower.includes('classes cancelled') ||
    lower.includes('classes canceled');

  const isHalfDay = lower.includes('half day') || lower.includes('half-day');
  const isTimingChange =
    (lower.includes('timing') || lower.includes('timings')) &&
    (lower.includes('changed') || lower.includes('change') || lower.includes('from'));

  if (isHoliday || isHalfDay || isTimingChange) {
    if (isHalfDay) {
      return {
        intent: 'SCHEDULE_OVERRIDE',
        holidayDeclaration: {
          isHoliday: true,
          targetDate,
          type: 'HALF_DAY',
          adjustedStartTime: '09:00',
          adjustedEndTime: '12:00',
          reason: 'Half-day college declared',
        },
        extractedSleep: null,
        unavailableWindow: null,
        tasksToSchedule: [],
        userExplanation: `Half-day college detected for ${isTomorrow ? 'tomorrow' : 'today'}. Your college commitment has been shortened to 09:00–12:00. Your regular weekly timetable remains unchanged. Here is your updated schedule.`,
        suggestedScheduleAction: 'APPLY_HOLIDAY',
      };
    }

    if (isTimingChange) {
      const timesMatch = userPrompt.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      let start = '10:00';
      let end = '13:00';
      if (timesMatch) {
        const p1 = parseTimeToMinutes(timesMatch[1]);
        const p2 = parseTimeToMinutes(timesMatch[2]);
        if (p1 && p2) {
          start = formatTime(p1.hours, p1.minutes);
          end = formatTime(p2.hours, p2.minutes);
        }
      }

      return {
        intent: 'SCHEDULE_OVERRIDE',
        holidayDeclaration: {
          isHoliday: true,
          targetDate,
          type: 'CUSTOM_HOURS',
          adjustedStartTime: start,
          adjustedEndTime: end,
          reason: 'Modified college timings',
        },
        extractedSleep: null,
        unavailableWindow: null,
        tasksToSchedule: [],
        userExplanation: `College timing change detected for ${isTomorrow ? 'tomorrow' : 'today'} (${start} – ${end}). Your regular weekly timetable remains unchanged. Here is your updated schedule.`,
        suggestedScheduleAction: 'APPLY_HOLIDAY',
      };
    }

    // Full holiday / No college
    return {
      intent: 'HOLIDAY_DECLARATION',
      holidayDeclaration: {
        isHoliday: true,
        targetDate,
        type: isTomorrow ? 'CANCEL_CLASSES' : 'FULL_HOLIDAY',
        reason: isTomorrow ? 'College cancelled tomorrow' : 'Holiday declared today',
      },
      extractedSleep: null,
      unavailableWindow: null,
      tasksToSchedule: [],
      userExplanation: `Holiday detected for ${isTomorrow ? 'tomorrow' : 'today'}. Your 9 AM–3 PM college commitment has been temporarily removed. Your regular weekly timetable remains unchanged. Here is your updated schedule.`,
      suggestedScheduleAction: 'APPLY_HOLIDAY',
    };
  }

  // 2. Morning Check-In & Sleep
  const isMorning = /morning|woke|wake|sleep|slept/i.test(userPrompt);
  const isUnavailable = /cannot work|emergency|dentist|doctor|unavailable|busy/i.test(userPrompt);

  let extractedSleep = null;
  if (isMorning) {
    const wakeMatch = userPrompt.match(/(?:woke up at|wake up at|woke at|wake at|woke up)\s*([0-9:]+\s*(?:am|pm)?)/i);
    const bedMatch = userPrompt.match(/(?:going to sleep at|slept at|sleep at|went to sleep at|after sleeping at)\s*([0-9:]+\s*(?:am|pm)?)/i);

    let wakeStr = '07:30';
    let bedStr = null;

    if (wakeMatch) {
      const parsedWake = parseTimeToMinutes(wakeMatch[1]);
      if (parsedWake) wakeStr = formatTime(parsedWake.hours, parsedWake.minutes);
    }
    if (bedMatch) {
      const parsedBed = parseTimeToMinutes(bedMatch[1]);
      if (parsedBed) bedStr = formatTime(parsedBed.hours, parsedBed.minutes);
    }

    let durationMins: number | null = null;
    if (bedStr && wakeStr) {
      const [bH, bM] = bedStr.split(':').map(Number);
      const [wH, wM] = wakeStr.split(':').map(Number);
      let tBed = bH * 60 + bM;
      let tWake = wH * 60 + wM;
      if (tWake < tBed) tWake += 24 * 60;
      durationMins = tWake - tBed;
    }

    extractedSleep = {
      bedTimeApprox: bedStr,
      wakeUpTime: wakeStr,
      sleepDurationMinutes: durationMins,
      notes: 'Extracted via LifeOS local heuristic parser (offline/quota fallback)',
    };
  }

  let unavailableWindow = null;
  if (isUnavailable) {
    const unavMatch = userPrompt.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (unavMatch) {
      const p1 = parseTimeToMinutes(unavMatch[1]);
      const p2 = parseTimeToMinutes(unavMatch[2]);
      if (p1 && p2) {
        unavailableWindow = {
          startTime: formatTime(p1.hours, p1.minutes),
          endTime: formatTime(p2.hours, p2.minutes),
          reason: 'Unavailable block',
        };
      }
    }
  }

  const tasksToSchedule: any[] = [];
  const taskRegex = /(?:complete|study|work on|practice|finish|review)\s+([^(\n,]+)(?:\((\d+)\s*(?:mins?|minutes?|hours?|h)?\))?/gi;
  let match;
  while ((match = taskRegex.exec(userPrompt)) !== null) {
    const title = match[1].trim();
    const durRaw = match[2];
    let dur = 45;
    if (durRaw) {
      dur = parseInt(durRaw, 10);
      if (dur <= 4) dur = dur * 60;
    }
    const isCoding = /leetcode|code|programming|algorithm/i.test(title);
    tasksToSchedule.push({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      category: isCoding ? 'PERSONAL_GROWTH' : 'DEADLINE',
      priority: 'HIGH',
      estimatedDuration: dur,
      reason: 'Scheduled based on user morning check-in',
    });
  }

  return {
    intent: isMorning ? 'MORNING_CHECKIN' : isUnavailable ? 'TIME_UNAVAILABLE' : 'ADD_TASK',
    holidayDeclaration: null,
    extractedSleep,
    unavailableWindow,
    tasksToSchedule,
    userExplanation: `Good morning! Logged ${extractedSleep?.sleepDurationMinutes ? Math.floor(extractedSleep.sleepDurationMinutes / 60) + 'h ' + (extractedSleep.sleepDurationMinutes % 60) + 'm' : 'your wake-up'} of rest. Scheduled your tasks with zero overlaps.${errorMessage ? ' (Offline fallback engine)' : ''}`,
    suggestedScheduleAction: tasksToSchedule.length > 0 ? 'CREATE_TASKS' : 'REGENERATE_SCHEDULE',
  };
}

function fallbackBreakdownGoal(goalName: string, category: string, targetWeeks: number): GoalBreakdown {
  return {
    goalName,
    overview: `A structured ${targetWeeks}-week pedagogical roadmap for ${goalName}, balancing conceptual fundamentals, hands-on application, and progressive milestones.`,
    recommendedSessionsPerWeek: 3,
    recommendedSessionDurationMins: 45,
    milestones: [
      {
        unitNumber: 1,
        title: 'Core Fundamentals & Orientation',
        topics: [
          { title: `${goalName} Basics & Conceptual Overview`, estimatedMinutes: 45, difficulty: 'EASY' },
          { title: 'Environment & Tooling Setup', estimatedMinutes: 30, difficulty: 'EASY' },
          { title: 'Core Syntax and Primitives', estimatedMinutes: 45, difficulty: 'MEDIUM' },
        ],
      },
      {
        unitNumber: 2,
        title: 'Practical Application & Problem Solving',
        topics: [
          { title: 'Hands-on Drills & Implementation', estimatedMinutes: 45, difficulty: 'MEDIUM' },
          { title: 'Intermediate Patterns & Techniques', estimatedMinutes: 60, difficulty: 'HARD' },
          { title: 'Mini-Project / Challenge 1', estimatedMinutes: 60, difficulty: 'HARD' },
        ],
      },
      {
        unitNumber: 3,
        title: 'Advanced Mastery & Synthesis',
        topics: [
          { title: 'Optimization & Best Practices', estimatedMinutes: 45, difficulty: 'MEDIUM' },
          { title: 'Capstone Project Integration', estimatedMinutes: 90, difficulty: 'HARD' },
        ],
      },
    ],
  };
}

function fallbackCarryForward(incompleteTasks: any[], upcomingScheduleContext: any): CarryForwardResponse {
  const tomorrowStr = upcomingScheduleContext?.tomorrowDate || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const recommendations = incompleteTasks.map((t: any, idx: number) => {
    const isRepeated = (t.timesPostponed || 0) >= 2;
    const isLarge = (t.remainingDuration || t.estimatedDuration || 45) > 60;

    let action: any = 'MOVE_TO_TOMORROW';
    if (isLarge) action = 'SPLIT_INTO_SMALLER';
    else if (idx >= 2) action = 'SLOT_INTO_UPCOMING_DAY';

    return {
      taskId: t.id,
      taskTitle: t.title,
      recommendedAction: action,
      targetDate: tomorrowStr,
      reason: isRepeated
        ? `Repeatedly postponed (${t.timesPostponed}x) — prioritized with buffer on ${tomorrowStr}`
        : `Carried forward safely to ${tomorrowStr}`,
    };
  });

  return {
    analysis: `Evaluated ${incompleteTasks.length} unfinished task(s). Distributed to protect tomorrow's capacity and maintain personal goal balance.`,
    recommendations,
  };
}
