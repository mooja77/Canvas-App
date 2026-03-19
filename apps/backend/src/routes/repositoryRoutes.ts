import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { checkRepositoryAccess } from '../middleware/planLimits.js';

export const repositoryRoutes = Router();

// All repository routes require repository access
repositoryRoutes.use('/repositories', checkRepositoryAccess());

// GET /api/repositories — List user's repositories
repositoryRoutes.get('/repositories', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const repositories = await prisma.researchRepository.findMany({
      where: { userId },
      include: { _count: { select: { insights: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, repositories });
  } catch (err) {
    next(err);
  }
});

// POST /api/repositories — Create repository
repositoryRoutes.post('/repositories', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('Repository name is required', 400);
    }

    const repository = await prisma.researchRepository.create({
      data: { userId, name: name.trim(), description: description || null },
    });

    res.status(201).json({ success: true, repository });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/repositories/:id — Delete repository
repositoryRoutes.delete('/repositories/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const repo = await prisma.researchRepository.findUnique({ where: { id: req.params.id } });
    if (!repo) throw new AppError('Repository not found', 404);
    if (repo.userId !== userId) throw new AppError('Access denied', 403);

    await prisma.researchRepository.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/insights — List insights
repositoryRoutes.get('/repositories/:id/insights', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const repo = await prisma.researchRepository.findUnique({ where: { id: req.params.id } });
    if (!repo) throw new AppError('Repository not found', 404);
    if (repo.userId !== userId) throw new AppError('Access denied', 403);

    const insights = await prisma.repositoryInsight.findMany({
      where: { repositoryId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, insights });
  } catch (err) {
    next(err);
  }
});

// POST /api/repositories/:id/insights — Create insight
repositoryRoutes.post('/repositories/:id/insights', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const repo = await prisma.researchRepository.findUnique({ where: { id: req.params.id } });
    if (!repo) throw new AppError('Repository not found', 404);
    if (repo.userId !== userId) throw new AppError('Access denied', 403);

    const { title, content, tags, canvasId, sourceType, sourceId } = req.body;
    if (!title || !content) throw new AppError('Title and content are required', 400);

    const insight = await prisma.repositoryInsight.create({
      data: {
        repositoryId: req.params.id,
        title,
        content,
        tags: JSON.stringify(tags || []),
        canvasId: canvasId || null,
        sourceType: sourceType || null,
        sourceId: sourceId || null,
      },
    });

    res.status(201).json({ success: true, insight });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/repositories/:repoId/insights/:insightId — Delete insight
repositoryRoutes.delete('/repositories/:repoId/insights/:insightId', async (req, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Email authentication required', 401);

    const repo = await prisma.researchRepository.findUnique({ where: { id: req.params.repoId } });
    if (!repo) throw new AppError('Repository not found', 404);
    if (repo.userId !== userId) throw new AppError('Access denied', 403);

    const insight = await prisma.repositoryInsight.findUnique({ where: { id: req.params.insightId } });
    if (!insight || insight.repositoryId !== req.params.repoId) throw new AppError('Insight not found', 404);

    await prisma.repositoryInsight.delete({ where: { id: req.params.insightId } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
