import { Router } from 'express';
import { healthRoutes } from '../modules/health/health.routes.js';
import { profileRoutes } from '../modules/profiles/profiles.routes.js';
import { settingsRoutes } from '../modules/settings/settings.routes.js';
import { friendRoutes, blockRoutes } from '../modules/friends/friends.routes.js';
import { roomRoutes } from '../modules/rooms/rooms.routes.js';
import { invitationRoutes } from '../modules/invitations/invitations.routes.js';
import { gamesRouter } from '../modules/games/games.routes.js';
import { matchesRouter } from '../modules/matches/matches.routes.js';
import { statsRouter } from '../modules/stats/stats.routes.js';
import { rivalryRouter } from '../modules/rivalry/rivalry.routes.js';
import { adminRouter } from '../modules/admin/admin.routes.js';
import { checkAccountStatus } from '../middleware/rbac.js';

export const apiRouter = Router();

apiRouter.use('/', healthRoutes);
apiRouter.use(checkAccountStatus);

apiRouter.use('/profiles', profileRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/friends', friendRoutes);
apiRouter.use('/blocks', blockRoutes);
apiRouter.use('/rooms', roomRoutes);
apiRouter.use('/invitations/rooms', invitationRoutes);
apiRouter.use('/invitations', invitationRoutes);
apiRouter.use('/games', gamesRouter);
apiRouter.use('/matches', matchesRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/rivalry', rivalryRouter);
apiRouter.use('/admin', adminRouter);



