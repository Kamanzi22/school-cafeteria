-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "allowsSides" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sides" TEXT;

-- CreateTable
CREATE TABLE "MenuSide" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuSide_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuSide_restaurantId_idx" ON "MenuSide"("restaurantId");

-- AddForeignKey
ALTER TABLE "MenuSide" ADD CONSTRAINT "MenuSide_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

