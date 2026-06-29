-- CreateTable
CREATE TABLE "DealerExecutionLog" (
    "id" TEXT NOT NULL,
    "parentLogId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "dealerName" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ciudad" TEXT,
    "estado" TEXT,
    "pdfS3Key" TEXT,
    "executionTime" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerExecutionLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "DealerExecutionLog" ADD CONSTRAINT "DealerExecutionLog_parentLogId_fkey" FOREIGN KEY ("parentLogId") REFERENCES "ExecutionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
