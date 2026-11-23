-- ASD durations can now be a half hour (2.5 = 2h30).
-- AlterTable
ALTER TABLE "Trip" ALTER COLUMN "hours" SET DATA TYPE DOUBLE PRECISION;
