-- PlaySpace Wave 1 S1: deny direct browser-role access to application tables.
-- This migration is additive and preserves all rows.
-- Intentionally do not FORCE ROW LEVEL SECURITY: Prisma currently uses a trusted
-- server-side database role. Verify and narrow that runtime role separately before
-- changing owner/BYPASSRLS behavior or adding user-scoped database policies.

ALTER TABLE public."UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FriendRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Friendship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BlockedUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoomParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoomInvitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoomMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GameVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GameSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GameSessionParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GameAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MatchParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserGameStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RivalryStats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AppRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserModeration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."GameConfiguration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."QuestionEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

-- Application data is accessed through authenticated Express APIs. The browser's
-- Supabase client is retained for Auth; anon/authenticated must not read or mutate
-- application records directly through the Supabase Data API.
REVOKE ALL PRIVILEGES ON TABLE
  public."UserProfile",
  public."UserSettings",
  public."FriendRequest",
  public."Friendship",
  public."BlockedUser",
  public."Room",
  public."RoomParticipant",
  public."RoomInvitation",
  public."RoomMessage",
  public."GameVote",
  public."GameSession",
  public."GameSessionParticipant",
  public."GameAction",
  public."Match",
  public."MatchParticipant",
  public."UserGameStats",
  public."RivalryStats",
  public."AppRole",
  public."UserModeration",
  public."GameConfiguration",
  public."QuestionEntry",
  public."AuditLog"
FROM anon, authenticated;

-- No broad "authenticated can do everything" policies are created. With RLS enabled
-- and no policies, direct access remains denied unless a future narrowly scoped
-- browser operation is explicitly designed, granted and tested.
