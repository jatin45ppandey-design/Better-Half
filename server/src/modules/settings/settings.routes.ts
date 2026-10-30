import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { getMySettings, updateMySettings } from './settings.controller.js';
import { updateSettingsSchema } from './settings.schema.js';

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth);

settingsRoutes.get('/', getMySettings);
settingsRoutes.patch('/', validateRequest({ body: updateSettingsSchema }), updateMySettings);

