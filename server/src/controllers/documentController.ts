import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db/client.js';
import { DocumentParser } from '../services/documentParser.js';
import { AcademicAIService } from '../services/academicAIService.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err: any = new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, TXT, PNG, JPG, WEBP`);
      err.statusCode = 400;
      cb(err);
    }
  },
});

export async function uploadAndAnalyzeDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { docCategory = 'SYLLABUS' } = req.body;

    // Normalize file type label
    let fileType = 'TXT';
    if (file.mimetype === 'application/pdf') fileType = 'PDF';
    else if (file.mimetype.includes('word')) fileType = 'DOCX';
    else if (file.mimetype.startsWith('image/')) fileType = 'IMAGE';

    // 1. Create UploadedDocument record in DB scoped to userId
    const docRecord = await prisma.uploadedDocument.create({
      data: {
        userId,
        fileName: file.originalname,
        fileType,
        fileSize: file.size,
        filePath: file.path,
        docCategory,
        status: 'PROCESSING',
      },
    });

    try {
      // 2. Extract content (text or multimodal base64)
      const parsedDoc = await DocumentParser.parseFile(file.path, file.mimetype);

      // 3. Call Academic AI service
      const analysis = await AcademicAIService.analyzeDocument(
        parsedDoc,
        file.originalname,
        docCategory as any
      );

      // 4. Update DB record with parsed data
      const updatedDoc = await prisma.uploadedDocument.update({
        where: { id: docRecord.id },
        data: {
          parsedData: JSON.stringify(analysis),
          status: 'PARSED',
          docCategory: analysis.documentType || docCategory,
        },
      });

      res.status(201).json({
        success: true,
        document: updatedDoc,
        analysis,
      });
    } catch (analysisErr: any) {
      await prisma.uploadedDocument.update({
        where: { id: docRecord.id },
        data: {
          status: 'ERROR',
          parsedData: JSON.stringify({ error: analysisErr.message }),
        },
      });
      throw analysisErr;
    }
  } catch (error) {
    next(error);
  }
}

export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const docs = await prisma.uploadedDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(docs);
  } catch (error) {
    next(error);
  }
}

export async function getDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const doc = await prisma.uploadedDocument.findFirst({
      where: { id, userId },
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const doc = await prisma.uploadedDocument.findFirst({
      where: { id, userId },
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (fs.existsSync(doc.filePath)) {
      try {
        fs.unlinkSync(doc.filePath);
      } catch (e) {
        console.warn('Could not delete file from disk:', e);
      }
    }

    await prisma.uploadedDocument.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Smart Subject Name & Code Normalization Helpers
function normalizeSubjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, ' ') // remove parenthetical subtitles e.g. "(PDE, Probability and Statistics)"
    .replace(/\bmaths\b/g, 'mathematics')
    .replace(/\bmath\b/g, 'mathematics')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCodeTokens(codeStr?: string | null): string[] {
  if (!codeStr) return [];
  return codeStr
    .split(/[\/,;\s]+/)
    .map((c) => c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
    .filter((c) => c.length >= 3);
}

function getWordTokens(normName: string): Set<string> {
  const words = normName
    .split(/\s+/)
    .map((w) => w.replace(/s$/, '')) // basic singularization (e.g. structures -> structure)
    .filter((w) => w.length > 2 && !['and', 'the', 'for', 'with'].includes(w));
  return new Set(words);
}

async function findSmartMatchingSubject(
  userId: string,
  targetName: string,
  targetCode?: string | null
) {
  const existingSubjects = await prisma.subject.findMany({
    where: { userId },
  });

  const normTargetName = normalizeSubjectName(targetName);
  const targetTokens = extractCodeTokens(targetCode);
  const targetWordSet = getWordTokens(normTargetName);

  // 1. Direct or multi-token code match (e.g. "BAS303/ BAS303H" matches "BAS303")
  if (targetTokens.length > 0) {
    for (const sub of existingSubjects) {
      const subTokens = extractCodeTokens(sub.code);
      if (subTokens.length > 0) {
        const hasSharedCode = targetTokens.some((t) => subTokens.includes(t));
        if (hasSharedCode) {
          return sub;
        }
      }
    }
  }

  // 2. Normalized name match (e.g. "Maths IV" matches "MATHEMATICS-IV (PDE, Probability and Statistics)")
  for (const sub of existingSubjects) {
    const normSubName = normalizeSubjectName(sub.name);
    if (normSubName === normTargetName) {
      return sub;
    }
    // Check if one contains the other
    if (normTargetName.length >= 4 && normSubName.length >= 4) {
      if (normTargetName.includes(normSubName) || normSubName.includes(normTargetName)) {
        return sub;
      }
    }
    // Check significant word token overlap (e.g. "Data Structure" vs "Data Structures")
    const subWordSet = getWordTokens(normSubName);
    if (subWordSet.size >= 2 && targetWordSet.size >= 2) {
      let matchingWords = 0;
      for (const w of targetWordSet) {
        if (subWordSet.has(w)) matchingWords++;
      }
      if (matchingWords === targetWordSet.size || matchingWords === subWordSet.size) {
        return sub;
      }
    }
  }

  return null;
}

export async function commitDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const { documentType, syllabus, examTimetable } = req.body || {};

    const doc = await prisma.uploadedDocument.findFirst({
      where: { id, userId },
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    let parsedFromDoc: any = {};
    if (doc.parsedData) {
      try {
        parsedFromDoc = JSON.parse(doc.parsedData);
      } catch (e) {
        parsedFromDoc = {};
      }
    }

    const effectiveType = documentType || parsedFromDoc.documentType || doc.docCategory;
    const effectiveSyllabus = syllabus || parsedFromDoc.syllabus;
    const effectiveExamTimetable = examTimetable || parsedFromDoc.examTimetable;

    let affectedSubject: any = null;
    const committedExams: any[] = [];
    let importedUnitsCount = 0;
    let importedTopicsCount = 0;
    let importedExamsCount = 0;

    // 1. Commit Syllabus Data with Smart Duplicate Prevention (strictly scoped to this user)
    if (effectiveType === 'SYLLABUS' && effectiveSyllabus) {
      const subjectName = effectiveSyllabus.subjectName?.trim();
      const subjectCode = effectiveSyllabus.subjectCode?.trim() || null;

      if (!subjectName) {
        return res.status(400).json({ error: 'Subject name is required for syllabus import' });
      }

      // Check if subject already exists for this user using smart matching
      let subject = await findSmartMatchingSubject(userId, subjectName, subjectCode);

      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            userId,
            name: subjectName,
            code: subjectCode,
            colorTag: '#68754C',
          },
        });
      } else {
        // Enrich existing subject with incoming code or fuller name if needed
        const updates: any = {};
        if (subjectCode && (!subject.code || subjectCode.length > subject.code.length)) {
          updates.code = subjectCode;
        }
        if (subjectName.length > subject.name.length && subject.name.length < 15) {
          updates.name = subjectName;
        }
        if (Object.keys(updates).length > 0) {
          subject = await prisma.subject.update({
            where: { id: subject.id },
            data: updates,
          });
        }
      }

      affectedSubject = subject;

      // Import Units & Topics under this subject
      for (const u of effectiveSyllabus.units || []) {
        let unit = await prisma.unit.findFirst({
          where: {
            subjectId: subject.id,
            unitNumber: u.unitNumber,
          },
        });

        if (!unit) {
          unit = await prisma.unit.create({
            data: {
              subjectId: subject.id,
              unitNumber: u.unitNumber,
              title: u.title,
            },
          });
          importedUnitsCount++;
        } else {
          unit = await prisma.unit.update({
            where: { id: unit.id },
            data: { title: u.title },
          });
        }

        // Import Topics under this Unit (avoid duplicating identical titles)
        for (const t of u.topics || []) {
          const existingTopic = await prisma.unitTopic.findFirst({
            where: {
              unitId: unit.id,
              title: { equals: t.title.trim() },
            },
          });

          if (!existingTopic) {
            await prisma.unitTopic.create({
              data: {
                unitId: unit.id,
                title: t.title.trim(),
                estimatedMinutes: t.estimatedMinutes || 45,
                isCompleted: false,
              },
            });
            importedTopicsCount++;
          }
        }
      }
    }

    // 2. Commit Exam Timetable with Smart Duplicate Prevention (strictly scoped to this user)
    if (effectiveType === 'EXAM_TIMETABLE' && effectiveExamTimetable) {
      for (const exam of effectiveExamTimetable.exams || []) {
        const subName = exam.subjectName?.trim();
        if (!subName || !exam.examDate) continue;

        // Find or create subject for this user using smart matching
        let subject = await findSmartMatchingSubject(userId, subName, exam.subjectCode);

        if (!subject) {
          subject = await prisma.subject.create({
            data: {
              userId,
              name: subName,
              code: exam.subjectCode || null,
              colorTag: '#BE674D',
            },
          });
        }

        // Avoid duplicate exam on the same date for this subject
        const existingExam = await prisma.academicExam.findFirst({
          where: {
            subjectId: subject.id,
            examDate: exam.examDate,
          },
          include: { subject: true },
        });

        if (existingExam) {
          const updated = await prisma.academicExam.update({
            where: { id: existingExam.id },
            data: {
              startTime: exam.startTime || existingExam.startTime,
              endTime: exam.endTime || existingExam.endTime,
              location: exam.location || existingExam.location,
              notes: exam.notes || existingExam.notes,
            },
            include: { subject: true },
          });
          committedExams.push(updated);
        } else {
          const created = await prisma.academicExam.create({
            data: {
              subjectId: subject.id,
              examDate: exam.examDate,
              startTime: exam.startTime || null,
              endTime: exam.endTime || null,
              location: exam.location || null,
              notes: exam.notes || null,
            },
            include: { subject: true },
          });
          committedExams.push(created);
          importedExamsCount++;
        }
      }
    }

    // Update document status to PARSED
    await prisma.uploadedDocument.update({
      where: { id },
      data: { status: 'PARSED' },
    });

    res.json({
      success: true,
      message: 'Document data successfully committed to database',
      subject: affectedSubject,
      exams: committedExams,
      metrics: {
        importedUnitsCount,
        importedTopicsCount,
        importedExamsCount,
      },
    });
  } catch (error) {
    next(error);
  }
}
