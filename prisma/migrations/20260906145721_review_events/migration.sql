-- AlterTable
ALTER TABLE "WordProgress" ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seenCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReviewEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "corrected" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" INTEGER,
    "spokenAttempts" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" BIGINT NOT NULL,

    CONSTRAINT "ReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewEvent_userId_reviewedAt_idx" ON "ReviewEvent"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewEvent_userId_wordId_idx" ON "ReviewEvent"("userId", "wordId");

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
