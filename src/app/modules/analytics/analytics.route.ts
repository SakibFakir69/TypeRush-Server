import { Router, type Request, type Response, type NextFunction } from 'express';

import { verifyToken } from '../../middleware/jwt-token.js';
import { verifyRole } from '../../middleware/verify-role.js';
import { analyticsController } from './analytics.controller.js';
// ----------------------------------------------------

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export const analyticsRouter = Router();

analyticsRouter.use(verifyToken, verifyRole('ADMIN'));

analyticsRouter.get('/summary', asyncHandler((req, res) => analyticsController.getSummary(req, res)));
analyticsRouter.get('/timeseries', asyncHandler((req, res) => analyticsController.getTimeseries(req, res)));
analyticsRouter.post('/heartbeat', asyncHandler((req, res) => analyticsController.heartbeat(req, res)));