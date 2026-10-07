-- CreateTable
CREATE TABLE "RestaurantSession" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RestaurantSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestaurantSession_restaurantId_idx" ON "RestaurantSession"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantSession_enteredAt_idx" ON "RestaurantSession"("enteredAt");

-- AddForeignKey
ALTER TABLE "RestaurantSession" ADD CONSTRAINT "RestaurantSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same lock as every other table (see 20261005170000_lock_public_api_roles): row level security
-- with no policies, so Supabase's public API roles can't read it. The API's own login is the
-- table's owner and isn't affected. Those roles' access to new tables was already taken away.
ALTER TABLE "RestaurantSession" ENABLE ROW LEVEL SECURITY;
