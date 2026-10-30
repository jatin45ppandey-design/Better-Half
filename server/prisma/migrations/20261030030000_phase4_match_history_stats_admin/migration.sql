-- AlterTable UserProfile
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateTable Match
CREATE TABLE IF NOT EXISTS "Match" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "resultType" TEXT NOT NULL,
    "winnerUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "roundsPlayed" INTEGER NOT NULL DEFAULT 1,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable MatchParticipant
CREATE TABLE IF NOT EXISTS "MatchParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerNameSnapshot" TEXT NOT NULL,
    "usernameSnapshot" TEXT NOT NULL,
    "avatarUrlSnapshot" TEXT,
    "scoreValue" DOUBLE PRECISION,
    "scoreLabel" TEXT,
    "placement" INTEGER,
    "outcome" TEXT NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserGameStats
CREATE TABLE IF NOT EXISTS "UserGameStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "cooperativeCompletions" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable RivalryStats
CREATE TABLE IF NOT EXISTS "RivalryStats" (
    "id" TEXT NOT NULL,
    "userLowId" TEXT NOT NULL,
    "userHighId" TEXT NOT NULL,
    "matchesPlayed" INTEGER NOT NULL DEFAULT 0,
    "competitiveMatches" INTEGER NOT NULL DEFAULT 0,
    "userLowWins" INTEGER NOT NULL DEFAULT 0,
    "userHighWins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "cooperativeCompletions" INTEGER NOT NULL DEFAULT 0,
    "currentStreakHolder" TEXT,
    "currentStreakCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RivalryStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable AppRole
CREATE TABLE IF NOT EXISTS "AppRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserModeration
CREATE TABLE IF NOT EXISTS "UserModeration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "moderatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserModeration_pkey" PRIMARY KEY ("id")
);

-- CreateTable GameConfiguration
CREATE TABLE IF NOT EXISTS "GameConfiguration" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "coupleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "friendEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMessage" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable QuestionEntry
CREATE TABLE IF NOT EXISTS "QuestionEntry" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "questionType" TEXT,
    "optionA" TEXT,
    "optionB" TEXT,
    "category" TEXT,
    "intensity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Match_gameSessionId_key" ON "Match"("gameSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "MatchParticipant_matchId_userId_key" ON "MatchParticipant"("matchId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserGameStats_userId_gameId_key" ON "UserGameStats"("userId", "gameId");
CREATE UNIQUE INDEX IF NOT EXISTS "RivalryStats_userLowId_userHighId_key" ON "RivalryStats"("userLowId", "userHighId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppRole_userId_role_key" ON "AppRole"("userId", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "GameConfiguration_gameId_key" ON "GameConfiguration"("gameId");
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionEntry_sourceKey_key" ON "QuestionEntry"("sourceKey");

-- Performance Indexes
CREATE INDEX IF NOT EXISTS "Match_gameId_idx" ON "Match"("gameId");
CREATE INDEX IF NOT EXISTS "Match_mode_idx" ON "Match"("mode");
CREATE INDEX IF NOT EXISTS "Match_completedAt_idx" ON "Match"("completedAt");
CREATE INDEX IF NOT EXISTS "Match_winnerUserId_idx" ON "Match"("winnerUserId");
CREATE INDEX IF NOT EXISTS "Match_roomId_idx" ON "Match"("roomId");

CREATE INDEX IF NOT EXISTS "MatchParticipant_userId_createdAt_idx" ON "MatchParticipant"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MatchParticipant_matchId_idx" ON "MatchParticipant"("matchId");
CREATE INDEX IF NOT EXISTS "MatchParticipant_outcome_idx" ON "MatchParticipant"("outcome");

CREATE INDEX IF NOT EXISTS "UserGameStats_userId_idx" ON "UserGameStats"("userId");
CREATE INDEX IF NOT EXISTS "UserGameStats_gameId_idx" ON "UserGameStats"("gameId");

CREATE INDEX IF NOT EXISTS "RivalryStats_userLowId_idx" ON "RivalryStats"("userLowId");
CREATE INDEX IF NOT EXISTS "RivalryStats_userHighId_idx" ON "RivalryStats"("userHighId");
CREATE INDEX IF NOT EXISTS "RivalryStats_matchesPlayed_idx" ON "RivalryStats"("matchesPlayed");

CREATE INDEX IF NOT EXISTS "AppRole_role_idx" ON "AppRole"("role");

CREATE INDEX IF NOT EXISTS "UserModeration_userId_idx" ON "UserModeration"("userId");
CREATE INDEX IF NOT EXISTS "UserModeration_status_idx" ON "UserModeration"("status");

CREATE INDEX IF NOT EXISTS "GameConfiguration_isEnabled_idx" ON "GameConfiguration"("isEnabled");

CREATE INDEX IF NOT EXISTS "QuestionEntry_gameId_isActive_idx" ON "QuestionEntry"("gameId", "isActive");
CREATE INDEX IF NOT EXISTS "QuestionEntry_category_idx" ON "QuestionEntry"("category");
CREATE INDEX IF NOT EXISTS "QuestionEntry_intensity_idx" ON "QuestionEntry"("intensity");

CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Foreign Keys
ALTER TABLE "Match" ADD CONSTRAINT "Match_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserGameStats" ADD CONSTRAINT "UserGameStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RivalryStats" ADD CONSTRAINT "RivalryStats_userLowId_fkey" FOREIGN KEY ("userLowId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RivalryStats" ADD CONSTRAINT "RivalryStats_userHighId_fkey" FOREIGN KEY ("userHighId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppRole" ADD CONSTRAINT "AppRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserModeration" ADD CONSTRAINT "UserModeration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserModeration" ADD CONSTRAINT "UserModeration_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

