-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "group" INTEGER NOT NULL DEFAULT 1,
    "style" TEXT,
    "remind" BOOLEAN NOT NULL DEFAULT false,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Schedule" ("content", "createdAt", "end", "group", "id", "remind", "start", "style", "title", "updatedAt") SELECT "content", "createdAt", "end", "group", "id", "remind", "start", "style", "title", "updatedAt" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
