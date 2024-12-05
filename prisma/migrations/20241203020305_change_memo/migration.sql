/*
  Warnings:

  - You are about to drop the `Memo` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Memo";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "chatMemo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
