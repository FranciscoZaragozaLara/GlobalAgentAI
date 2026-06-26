-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "monthName" TEXT NOT NULL,
    "researchMode" TEXT NOT NULL,
    "reportMode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executionTime" DOUBLE PRECISION NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "researchS3Key" TEXT,
    "pdfS3Key" TEXT,
    "imagesS3Key" TEXT,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);
