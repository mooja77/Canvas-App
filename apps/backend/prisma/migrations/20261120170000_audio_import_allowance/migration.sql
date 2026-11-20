-- Free plan: one audio file import per account, counted server-side and never
-- handed back on delete. Counter lives on the account that owns the canvas.
ALTER TABLE "User" ADD COLUMN "audioImportsUsed" INTEGER NOT NULL DEFAULT 0;

-- Start from the files each account's canvases still hold, so an account that
-- already imported files is not given a fresh allowance.
UPDATE "User" u
SET "audioImportsUsed" = c.n
FROM (
  SELECT cc."userId" AS uid, COUNT(*)::INTEGER AS n
  FROM "FileUpload" f
  JOIN "CodingCanvas" cc ON cc."id" = f."canvasId"
  WHERE cc."userId" IS NOT NULL
  GROUP BY cc."userId"
) c
WHERE u."id" = c.uid;
