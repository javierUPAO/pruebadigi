-- CreateTable
CREATE TABLE "categories" (
    "id_categoria" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" INTEGER NOT NULL DEFAULT 1,
    "padre_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id_categoria")
);

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "categories"("id_categoria") ON DELETE CASCADE ON UPDATE CASCADE;
