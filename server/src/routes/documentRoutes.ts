import { Router } from 'express';
import {
  uploadMiddleware,
  uploadAndAnalyzeDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  commitDocument,
} from '../controllers/documentController.js';

const router = Router();

router.post('/upload', uploadMiddleware.single('file'), uploadAndAnalyzeDocument);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);
router.post('/:id/commit', commitDocument);

export default router;
