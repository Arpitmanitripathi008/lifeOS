import { getGeminiClient } from './geminiService.js';
import { z } from 'zod';
import type { ParsedDocumentResult } from './documentParser.js';

// 1. Zod Schemas for Academic Document Extraction
export const TopicItemSchema = z.object({
  title: z.string().min(1),
  estimatedMinutes: z.number().int().positive().default(45),
});

export const UnitItemSchema = z.object({
  unitNumber: z.number().int().positive(),
  title: z.string().min(1),
  topics: z.array(TopicItemSchema).default([]),
});

export const ExamItemSchema = z.object({
  subjectName: z.string().min(1),
  subjectCode: z.string().nullable().optional(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const AcademicExtractionSchema = z.object({
  documentType: z.enum(['SYLLABUS', 'EXAM_TIMETABLE', 'OTHER']).default('SYLLABUS'),
  confidence: z.number().min(0).max(1).default(0.9),
  unclearItems: z.array(z.string()).default([]),
  summary: z.string().default(''),
  syllabus: z
    .object({
      subjectName: z.string().min(1),
      subjectCode: z.string().nullable().optional(),
      units: z.array(UnitItemSchema).default([]),
    })
    .nullable()
    .optional(),
  examTimetable: z
    .object({
      examinationTitle: z.string().optional(),
      exams: z.array(ExamItemSchema).default([]),
    })
    .nullable()
    .optional(),
});

export type AcademicExtraction = z.infer<typeof AcademicExtractionSchema>;

export class AcademicAIService {
  /**
   * Analyzes an uploaded academic document (PDF, DOCX, TXT, or Image)
   */
  static async analyzeDocument(
    doc: ParsedDocumentResult,
    fileName: string,
    categoryHint?: 'SYLLABUS' | 'EXAM_TIMETABLE' | 'TIMETABLE' | 'OTHER'
  ): Promise<AcademicExtraction> {
    const { ai, model, error } = getGeminiClient();
    if (!ai) {
      throw new Error(error || 'Gemini API is not configured.');
    }

    const systemPrompt = `You are LifeOS Academic Document Intelligence, an expert academic parser.
Your task is to analyze uploaded syllabus documents or examination timetables and output clean, structured JSON.

CRITICAL RULES:
1. NEVER invent or hallucinate information missing from the uploaded document.
2. If dates, subject names, or unit titles are missing, ambiguous, or partially obscured, add a descriptive item to "unclearItems" explaining what needs user confirmation.
3. For Exam Timetables:
   - Extract subject names, subject codes, and exam dates.
   - Dates MUST be converted to "YYYY-MM-DD" format.
   - Extract start and end times in "HH:mm" (24-hour format) if available.
4. For Syllabi:
   - Extract Subject Name (e.g. "Operating Systems") and Subject Code (e.g. "CS-301").
   - Extract Units (numbered 1, 2, 3...) and their Unit Titles.
   - Extract Topics under each unit with an estimated study duration in minutes (default 45).

JSON FORMAT REQUIREMENTS:
If the document is a SYLLABUS:
{
  "documentType": "SYLLABUS",
  "confidence": 0.95,
  "unclearItems": [],
  "summary": "Brief 1-line summary of document",
  "syllabus": {
    "subjectName": "Exact Subject Name",
    "subjectCode": "Course Code or null",
    "units": [
      {
        "unitNumber": 1,
        "title": "Unit Title",
        "topics": [
          { "title": "Topic Name", "estimatedMinutes": 45 }
        ]
      }
    ]
  },
  "examTimetable": null
}

If the document is an EXAM TIMETABLE:
{
  "documentType": "EXAM_TIMETABLE",
  "confidence": 0.95,
  "unclearItems": [],
  "summary": "Brief 1-line summary",
  "syllabus": null,
  "examTimetable": {
    "examinationTitle": "Examination Title",
    "exams": [
      {
        "subjectName": "Subject Name",
        "subjectCode": "Course Code or null",
        "examDate": "YYYY-MM-DD",
        "startTime": "HH:mm or null",
        "endTime": "HH:mm or null",
        "location": "Room or hall if specified",
        "notes": "Any guidelines or null"
      }
    ]
  }
}`;

    const contents: any[] = [];

    // Multimodal image or PDF
    if (doc.isMultimodalImage && doc.base64Data) {
      contents.push({
        inlineData: {
          mimeType: doc.mimeType,
          data: doc.base64Data,
        },
      });
      contents.push({
        text: `${systemPrompt}\n\nAnalyze this image of an academic document (Filename: "${fileName}"). Category hint: ${categoryHint || 'AUTO_DETECT'}. Output strictly valid JSON.`,
      });
    } else if (doc.mimeType === 'application/pdf' && doc.base64Data && doc.text.trim().length < 50) {
      // Scanned PDF with little extractable text -> use multimodal PDF support
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: doc.base64Data,
        },
      });
      contents.push({
        text: `${systemPrompt}\n\nAnalyze this PDF academic document (Filename: "${fileName}"). Output strictly valid JSON.`,
      });
    } else {
      // Text-rich document (PDF text, DOCX, TXT)
      const textSample = doc.text.slice(0, 40000); // 40k chars safety limit
      contents.push({
        text: `${systemPrompt}\n\nDOCUMENT FILENAME: ${fileName}\nCATEGORY HINT: ${categoryHint || 'AUTO_DETECT'}\n\n--- DOCUMENT CONTENT START ---\n${textSample}\n--- DOCUMENT CONTENT END ---\n\nExtract and return strictly JSON conforming to the schema.`,
      });
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Low temperature for factual precision
        },
      });

      const responseText = response.text || '{}';
      const parsedRaw = JSON.parse(responseText);

      // Validate through Zod with forgiving defaults
      const validated = AcademicExtractionSchema.safeParse(parsedRaw);
      if (validated.success) {
        return validated.data;
      }

      console.warn('Zod validation issues on Gemini output:', validated.error.issues);
      // Fallback normalization
      return {
        documentType: parsedRaw.documentType || 'SYLLABUS',
        confidence: parsedRaw.confidence || 0.8,
        unclearItems: Array.isArray(parsedRaw.unclearItems) ? parsedRaw.unclearItems : [],
        summary: parsedRaw.summary || `Extracted data from ${fileName}`,
        syllabus: parsedRaw.syllabus || null,
        examTimetable: parsedRaw.examTimetable || null,
      };
    } catch (err: any) {
      console.warn(`[AcademicAIService] Gemini API error (${err.message}). Activating local deterministic parser.`);
      if (doc.text && doc.text.trim().length > 10) {
        return fallbackParseAcademicDocument(doc.text, fileName, categoryHint);
      }
      throw new Error(`Academic AI analysis failed: ${err.message}`);
    }
  }

  /**
   * Generates a multi-day spaced revision study plan leading up to an exam
   */
  static async generateStudyPlan(params: {
    subjectName: string;
    examDate: string; // "YYYY-MM-DD"
    topics: Array<{ id?: string; title: string; estimatedMinutes?: number }>;
    startDate?: string;
  }): Promise<{
    title: string;
    explanation: string;
    tasks: Array<{
      title: string;
      unitTopicId?: string;
      scheduledDate: string;
      durationMinutes: number;
      priority: 'HIGH' | 'URGENT';
      sessionType: 'TOPIC_STUDY' | 'REVISION' | 'MOCK_TEST';
    }>;
  }> {
    const { ai, model, error } = getGeminiClient();
    if (!ai) {
      throw new Error(error || 'Gemini API is not configured.');
    }

    const todayStr = params.startDate || new Date().toISOString().split('T')[0];

    const prompt = `You are LifeOS Academic Study Planner.
Generate a structured, spaced revision study plan for the subject "${params.subjectName}".
Target Exam Date: ${params.examDate}
Current Date: ${todayStr}

Topics to cover:
${params.topics.map((t, idx) => `${idx + 1}. ${t.title} (${t.estimatedMinutes || 45} mins)`).join('\n')}

RULES:
1. Distribute topics evenly across the days between ${todayStr} and the day before ${params.examDate}.
2. Cap daily study time for this subject at max 90–120 minutes so the student does not burn out.
3. Schedule a comprehensive final review / mock session on the day immediately preceding ${params.examDate}.
4. Prioritize essential topics earlier to leave buffer time.
5. Output JSON conforming to this structure:
{
  "title": "Study Plan for ${params.subjectName}",
  "explanation": "Summary of plan structure and spacing rationale",
  "tasks": [
    {
      "title": "Topic title or Review session name",
      "topicIndex": 0,
      "scheduledDate": "YYYY-MM-DD",
      "durationMinutes": 45,
      "priority": "HIGH",
      "sessionType": "TOPIC_STUDY"
    }
  ]
}`;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const tasks = (parsed.tasks || []).map((t: any) => {
        const matchedTopic =
          typeof t.topicIndex === 'number' && params.topics[t.topicIndex]
            ? params.topics[t.topicIndex]
            : null;

        return {
          title: t.title,
          unitTopicId: matchedTopic?.id || undefined,
          scheduledDate: t.scheduledDate,
          durationMinutes: t.durationMinutes || 45,
          priority: (t.priority as any) || 'HIGH',
          sessionType: t.sessionType || 'TOPIC_STUDY',
        };
      });

      return {
        title: parsed.title || `Study Plan: ${params.subjectName}`,
        explanation: parsed.explanation || 'Spaced revision plan leading up to exam',
        tasks,
      };
    } catch (err: any) {
      console.warn(`[AcademicAIService.generateStudyPlan] Gemini error (${err.message}). Using deterministic planner.`);
      return fallbackGenerateStudyPlan(params);
    }
  }
}

function fallbackGenerateStudyPlan(params: {
  subjectName: string;
  examDate: string;
  topics: Array<{ id?: string; title: string; estimatedMinutes?: number }>;
  startDate?: string;
}): {
  title: string;
  explanation: string;
  tasks: Array<{
    title: string;
    unitTopicId?: string;
    scheduledDate: string;
    durationMinutes: number;
    priority: 'HIGH' | 'URGENT';
    sessionType: 'TOPIC_STUDY' | 'REVISION' | 'MOCK_TEST';
  }>;
} {
  const [eY, eM, eD] = params.examDate.split('-').map(Number);
  const examDateObj = new Date(eY, eM - 1, eD);

  const startStr = params.startDate || new Date().toISOString().split('T')[0];
  const [sY, sM, sD] = startStr.split('-').map(Number);
  const startDateObj = new Date(sY, sM - 1, sD);

  const totalDays = Math.max(1, Math.floor((examDateObj.getTime() - startDateObj.getTime()) / (1000 * 3600 * 24)));
  const tasks: any[] = [];

  // Slot topics sequentially leading up to exam
  params.topics.forEach((topic, idx) => {
    const dayOffset = Math.min(totalDays - 2, Math.floor((idx / Math.max(1, params.topics.length)) * (totalDays - 1)));
    const taskDate = new Date(sY, sM - 1, sD + dayOffset);
    const dateFormatted = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}-${String(taskDate.getDate()).padStart(2, '0')}`;

    tasks.push({
      title: `Study: ${topic.title}`,
      unitTopicId: topic.id,
      scheduledDate: dateFormatted,
      durationMinutes: topic.estimatedMinutes || 45,
      priority: 'HIGH',
      sessionType: 'TOPIC_STUDY',
    });
  });

  // Final review on the day before the exam
  const dayBefore = new Date(eY, eM - 1, eD - 1);
  const dayBeforeFormatted = `${dayBefore.getFullYear()}-${String(dayBefore.getMonth() + 1).padStart(2, '0')}-${String(dayBefore.getDate()).padStart(2, '0')}`;
  tasks.push({
    title: `Comprehensive Final Revision: ${params.subjectName}`,
    scheduledDate: dayBeforeFormatted,
    durationMinutes: 60,
    priority: 'URGENT',
    sessionType: 'REVISION',
  });

  return {
    title: `Spaced Revision Plan: ${params.subjectName}`,
    explanation: `Deterministic spaced study plan over ${totalDays} days leading to examination on ${params.examDate}.`,
    tasks,
  };
}

function fallbackParseAcademicDocument(
  text: string,
  fileName: string,
  categoryHint?: string
): AcademicExtraction {
  const isExam =
    categoryHint === 'EXAM_TIMETABLE' ||
    categoryHint === 'TIMETABLE' ||
    /exam|timetable|mid-semester|schedule/i.test(text);

  if (isExam && !/course syllabus/i.test(text)) {
    const exams: any[] = [];
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    let currentSubject = '';
    let currentCode: string | null = null;
    let currentDate = '';
    let currentStart: string | null = null;
    let currentEnd: string | null = null;
    let currentLocation: string | null = null;

    for (const line of lines) {
      const subMatch = line.match(/(?:Subject|Course):\s*([^(\n]+)(?:\(([^)]+)\))?/i);
      if (subMatch) {
        currentSubject = subMatch[1].trim();
        currentCode = subMatch[2]?.trim() || null;
      }
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        currentDate = dateMatch[1];
      }
      const timeMatch = line.match(/(\d{1,2}:\d{2})\s*(?:-|to)\s*(\d{1,2}:\d{2})/i);
      if (timeMatch) {
        currentStart = timeMatch[1].padStart(5, '0');
        currentEnd = timeMatch[2].padStart(5, '0');
      }
      const locMatch = line.match(/(?:Location|Hall|Room):\s*([^\n]+)/i);
      if (locMatch) {
        currentLocation = locMatch[1].trim();
      }

      if (currentSubject && currentDate) {
        exams.push({
          subjectName: currentSubject,
          subjectCode: currentCode,
          examDate: currentDate,
          startTime: currentStart,
          endTime: currentEnd,
          location: currentLocation,
          notes: 'Extracted via LifeOS deterministic parser (offline/quota fallback)',
        });
        currentSubject = '';
        currentCode = null;
        currentDate = '';
        currentStart = null;
        currentEnd = null;
        currentLocation = null;
      }
    }

    if (exams.length > 0) {
      return {
        documentType: 'EXAM_TIMETABLE',
        confidence: 0.9,
        unclearItems: ['Parsed using deterministic rule fallback due to Gemini API limits. Please verify dates.'],
        summary: `Parsed ${exams.length} examination(s) from ${fileName}`,
        syllabus: null,
        examTimetable: {
          examinationTitle: 'Examination Schedule',
          exams,
        },
      };
    }
  }

  // Parse Syllabus
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let subjectName = 'Academic Subject';
  let subjectCode: string | null = null;

  for (const line of lines) {
    const subMatch = line.match(/(?:COURSE SYLLABUS|Syllabus|Subject):\s*([^(\n]+)(?:\(([^)]+)\))?/i);
    if (subMatch) {
      subjectName = subMatch[1].trim();
      subjectCode = subMatch[2]?.trim() || null;
      break;
    }
  }

  const units: any[] = [];
  let currentUnit: any = null;

  for (const line of lines) {
    const unitMatch = line.match(/Unit\s+(\d+)[:\s]+(.+)/i);
    if (unitMatch) {
      currentUnit = {
        unitNumber: parseInt(unitMatch[1], 10),
        title: unitMatch[2].trim(),
        topics: [],
      };
      units.push(currentUnit);
      continue;
    }

    const topicBulletMatch = line.match(/^[-*•]\s*(.+)/);
    if (topicBulletMatch && currentUnit) {
      const rawTitle = topicBulletMatch[1].trim();
      const durMatch = rawTitle.match(/\((\d+)\s*mins?\)/i);
      const estimatedMinutes = durMatch ? parseInt(durMatch[1], 10) : 45;
      const cleanTitle = rawTitle.replace(/\s*\(\d+\s*mins?\)/i, '').trim();

      currentUnit.topics.push({
        title: cleanTitle,
        estimatedMinutes,
      });
    }
  }

  if (units.length === 0) {
    units.push({
      unitNumber: 1,
      title: 'Course Core Modules',
      topics: [
        { title: 'Core Principles & Overview', estimatedMinutes: 45 },
        { title: 'Advanced Concepts', estimatedMinutes: 60 },
      ],
    });
  }

  return {
    documentType: 'SYLLABUS',
    confidence: 0.88,
    unclearItems: ['Parsed using deterministic pattern engine (offline/quota fallback).'],
    summary: `Parsed syllabus for ${subjectName} with ${units.length} unit(s).`,
    syllabus: {
      subjectName,
      subjectCode,
      units,
    },
    examTimetable: null,
  };
}
