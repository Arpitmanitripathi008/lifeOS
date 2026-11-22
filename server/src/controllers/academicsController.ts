import type { Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';

export const createSubjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional().nullable(),
  colorTag: z.string().default('#68754C'),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const createUnitSchema = z.object({
  unitNumber: z.number().int().positive(),
  title: z.string().min(1, 'Title is required'),
});

export const updateUnitSchema = z.object({
  unitNumber: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
});

export const createTopicSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  estimatedMinutes: z.number().int().positive().default(45),
});

export const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  isCompleted: z.boolean().optional(),
});

export const createExamSchema = z.object({
  subjectId: z.string().uuid(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createAssignmentSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimatedHours: z.number().positive().default(2.0),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED']).default('PENDING'),
});

// Subjects
export async function getSubjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const subjects = await prisma.subject.findMany({
      where: { userId },
      include: {
        units: {
          include: {
            topics: true,
          },
          orderBy: { unitNumber: 'asc' },
        },
        exams: {
          orderBy: { examDate: 'asc' },
        },
        assignments: {
          orderBy: { deadline: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(subjects);
  } catch (error) {
    next(error);
  }
}

export async function createSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const subject = await prisma.subject.create({
      data: {
        ...req.body,
        userId,
      },
    });
    res.status(201).json(subject);
  } catch (error) {
    next(error);
  }
}

export async function updateSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const existing = await prisma.subject.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found or access denied.' });
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const existing = await prisma.subject.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found or access denied.' });
    }

    await prisma.$transaction(async (tx) => {
      // Find all units belonging to this subject
      const units = await tx.unit.findMany({ where: { subjectId: id } });
      const unitIds = units.map((u) => u.id);

      if (unitIds.length > 0) {
        const topics = await tx.unitTopic.findMany({
          where: { unitId: { in: unitIds } },
          select: { id: true },
        });
        const topicIds = topics.map((t) => t.id);

        if (topicIds.length > 0) {
          await tx.task.updateMany({
            where: { unitTopicId: { in: topicIds } },
            data: { unitTopicId: null },
          });
          await tx.unitTopic.deleteMany({ where: { unitId: { in: unitIds } } });
        }
        await tx.unit.deleteMany({ where: { subjectId: id } });
      }

      // Disassociate tasks linked to this subject
      await tx.task.updateMany({
        where: { subjectId: id },
        data: { subjectId: null },
      });

      // Delete exams and assignments
      await tx.academicExam.deleteMany({ where: { subjectId: id } });
      await tx.assignment.deleteMany({ where: { subjectId: id } });

      // Delete subject
      await tx.subject.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Units & Topics
export async function addUnit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const subjectId = req.params.subjectId as string;
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found or access denied.' });
    }

    const unit = await prisma.unit.create({
      data: {
        ...req.body,
        subjectId,
      },
      include: { topics: true },
    });
    res.status(201).json(unit);
  } catch (error) {
    next(error);
  }
}

export async function updateUnit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: { subject: true },
    });
    if (!unit || unit.subject.userId !== userId) {
      return res.status(404).json({ error: 'Unit not found or access denied.' });
    }

    const updated = await prisma.unit.update({
      where: { id },
      data: req.body,
      include: { topics: true },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteUnit(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const unit = await prisma.unit.findUnique({
      where: { id },
      include: { subject: true },
    });
    if (!unit || unit.subject.userId !== userId) {
      return res.status(404).json({ error: 'Unit not found or access denied.' });
    }

    await prisma.$transaction(async (tx) => {
      const topics = await tx.unitTopic.findMany({
        where: { unitId: id },
        select: { id: true },
      });
      const topicIds = topics.map((t) => t.id);
      if (topicIds.length > 0) {
        await tx.task.updateMany({
          where: { unitTopicId: { in: topicIds } },
          data: { unitTopicId: null },
        });
        await tx.unitTopic.deleteMany({ where: { unitId: id } });
      }
      await tx.unit.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function addTopic(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const unitId = req.params.unitId as string;
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: { subject: true },
    });
    if (!unit || unit.subject.userId !== userId) {
      return res.status(404).json({ error: 'Unit not found or access denied.' });
    }

    const topic = await prisma.unitTopic.create({
      data: {
        ...req.body,
        unitId,
      },
    });
    res.status(201).json(topic);
  } catch (error) {
    next(error);
  }
}

export async function updateTopic(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const topic = await prisma.unitTopic.findUnique({
      where: { id },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.userId !== userId) {
      return res.status(404).json({ error: 'Topic not found or access denied.' });
    }

    const updated = await prisma.unitTopic.update({
      where: { id },
      data: req.body,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteTopic(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const topic = await prisma.unitTopic.findUnique({
      where: { id },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.userId !== userId) {
      return res.status(404).json({ error: 'Topic not found or access denied.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { unitTopicId: id },
        data: { unitTopicId: null },
      });
      await tx.unitTopic.delete({ where: { id } });
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function toggleTopic(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const topic = await prisma.unitTopic.findUnique({
      where: { id },
      include: { unit: { include: { subject: true } } },
    });
    if (!topic || topic.unit.subject.userId !== userId) {
      return res.status(404).json({ error: 'Topic not found or access denied.' });
    }
    const updated = await prisma.unitTopic.update({
      where: { id },
      data: { isCompleted: !topic.isCompleted },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// Exams
export async function getExams(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const exams = await prisma.academicExam.findMany({
      where: {
        subject: { userId },
      },
      include: { subject: true },
      orderBy: { examDate: 'asc' },
    });
    res.json(exams);
  } catch (error) {
    next(error);
  }
}

export async function createExam(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { subjectId } = req.body;
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found or access denied.' });
    }

    const exam = await prisma.academicExam.create({
      data: req.body,
      include: { subject: true },
    });
    res.status(201).json(exam);
  } catch (error) {
    next(error);
  }
}

export async function deleteExam(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const exam = await prisma.academicExam.findUnique({
      where: { id },
      include: { subject: true },
    });
    if (!exam || exam.subject.userId !== userId) {
      return res.status(404).json({ error: 'Exam not found or access denied.' });
    }

    await prisma.academicExam.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Assignments
export async function getAssignments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const assignments = await prisma.assignment.findMany({
      where: {
        subject: { userId },
      },
      include: { subject: true },
      orderBy: { deadline: 'asc' },
    });
    res.json(assignments);
  } catch (error) {
    next(error);
  }
}

export async function createAssignment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { subjectId } = req.body;
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found or access denied.' });
    }

    const assignment = await prisma.assignment.create({
      data: req.body,
      include: { subject: true },
    });
    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
}

export async function updateAssignment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true },
    });
    if (!assignment || assignment.subject.userId !== userId) {
      return res.status(404).json({ error: 'Assignment not found or access denied.' });
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: req.body,
      include: { subject: true },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteAssignment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { subject: true },
    });
    if (!assignment || assignment.subject.userId !== userId) {
      return res.status(404).json({ error: 'Assignment not found or access denied.' });
    }

    // Disassociate any tasks linked to this assignment
    await prisma.task.updateMany({
      where: { assignmentId: id },
      data: { assignmentId: null },
    });

    await prisma.assignment.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Study Plan Generator for Exams
export async function generateExamStudyPlan(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { subjectId, examId, targetExamDate } = req.body;

    let resolvedSubjectId = subjectId;
    if (!resolvedSubjectId && examId) {
      const exam = await prisma.academicExam.findUnique({
        where: { id: examId },
        include: { subject: true },
      });
      if (exam && exam.subject.userId === userId) {
        resolvedSubjectId = exam.subjectId;
      }
    }

    if (!resolvedSubjectId) {
      return res.status(400).json({ error: 'Either valid subjectId or examId is required' });
    }

    const subject = await prisma.subject.findFirst({
      where: { id: resolvedSubjectId, userId },
      include: {
        units: {
          include: {
            topics: {
              where: { isCompleted: false },
            },
          },
          orderBy: { unitNumber: 'asc' },
        },
        exams: {
          orderBy: { examDate: 'asc' },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found or access denied.' });
    }

    let resolvedExamDate = targetExamDate;
    if (!resolvedExamDate) {
      if (examId) {
        const exam = await prisma.academicExam.findUnique({ where: { id: examId } });
        resolvedExamDate = exam?.examDate;
      } else if (subject.exams.length > 0) {
        resolvedExamDate = subject.exams[0].examDate;
      }
    }

    if (!resolvedExamDate) {
      return res.status(400).json({
        error: 'No upcoming exam date specified or found for this subject. Please specify an exam date.',
      });
    }

    // Flatten uncompleted topics
    const topics = subject.units.flatMap((u) =>
      u.topics.map((t) => ({
        id: t.id,
        title: `Unit ${u.unitNumber}: ${t.title}`,
        estimatedMinutes: t.estimatedMinutes,
      }))
    );

    if (topics.length === 0) {
      return res.status(400).json({
        error: 'All topics for this subject are already marked as completed!',
      });
    }

    const { AcademicAIService } = await import('../services/academicAIService.js');
    const plan = await AcademicAIService.generateStudyPlan({
      subjectName: subject.name,
      examDate: resolvedExamDate,
      topics,
    });

    const proposal = await prisma.aIProposal.create({
      data: {
        userId,
        proposalType: 'STUDY_PLAN',
        targetDate: resolvedExamDate,
        proposalData: JSON.stringify({
          subjectId: subject.id,
          subjectName: subject.name,
          examDate: resolvedExamDate,
          ...plan,
        }),
        explanation: plan.explanation,
        status: 'PENDING',
      },
    });

    res.json({
      success: true,
      proposalId: proposal.id,
      proposal,
      plan,
    });
  } catch (error) {
    next(error);
  }
}

