import { Request, Response, NextFunction } from 'express';
import { profilesService } from './profiles.service.js';

export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;
    const metadata = req.user!.user_metadata;

    if ((req as any).userProfile && (req as any).userProfile.username) {
      res.status(200).json((req as any).userProfile);
      return;
    }

    const profile = await profilesService.getOrCreateProfile(userId, email, metadata);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updateMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const updated = await profilesService.updateProfile(userId, req.body);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

export async function getProfileByUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
    const profile = await profilesService.getProfileByUsername(username);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function searchProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = (req.query.q as string) || '';
    const currentUserId = req.user!.id;
    const results = await profilesService.searchProfiles(query, currentUserId);
    res.status(200).json({ results });
  } catch (error) {
    next(error);
  }
}
