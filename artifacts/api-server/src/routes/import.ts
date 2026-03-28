import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hotspotCardsTable, broadbandCardsTable, salesPointsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/import/hotspot", async (req, res) => {
  try {
    const { records } = req.body as {
      records: Array<{ serial: string; denomination: number; batchNumber?: string; status?: string }>;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "records array is required and must not be empty" });
      return;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const validBatch = batch.filter(r => r.serial && r.denomination);

      if (validBatch.length < batch.length) {
        skipped += batch.length - validBatch.length;
      }

      if (validBatch.length > 0) {
        try {
          const result = await db.insert(hotspotCardsTable).values(
            validBatch.map(r => ({
              serial: r.serial,
              denomination: r.denomination,
              batchNumber: r.batchNumber ?? null,
              status: r.status ?? "available",
            }))
          ).onConflictDoNothing().returning({ id: hotspotCardsTable.id });
          imported += result.length;
          skipped += validBatch.length - result.length;
        } catch (err) {
          errors.push(`Batch ${i}-${i + BATCH_SIZE}: ${String(err)}`);
          skipped += validBatch.length;
        }
      }
    }

    res.json({ imported, skipped, errors });
  } catch (error) {
    res.status(500).json({ error: "Failed to import hotspot cards", details: String(error) });
  }
});

router.post("/import/broadband", async (req, res) => {
  try {
    const { records } = req.body as {
      records: Array<{ serial: string; denomination: number; batchNumber?: string; status?: string }>;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "records array is required and must not be empty" });
      return;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const validBatch = batch.filter(r => r.serial && r.denomination);

      if (validBatch.length < batch.length) {
        skipped += batch.length - validBatch.length;
      }

      if (validBatch.length > 0) {
        try {
          const result = await db.insert(broadbandCardsTable).values(
            validBatch.map(r => ({
              serial: r.serial,
              denomination: r.denomination,
              batchNumber: r.batchNumber ?? null,
              status: r.status ?? "available",
            }))
          ).onConflictDoNothing().returning({ id: broadbandCardsTable.id });
          imported += result.length;
          skipped += validBatch.length - result.length;
        } catch (err) {
          errors.push(`Batch ${i}-${i + BATCH_SIZE}: ${String(err)}`);
          skipped += validBatch.length;
        }
      }
    }

    res.json({ imported, skipped, errors });
  } catch (error) {
    res.status(500).json({ error: "Failed to import broadband cards", details: String(error) });
  }
});

router.post("/import/sales-points", async (req, res) => {
  try {
    const { records } = req.body as {
      records: Array<{ name: string; location?: string; contactName?: string; contactPhone?: string; status?: string }>;
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "records array is required and must not be empty" });
      return;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const validRecords = records.filter(r => r.name);
    skipped += records.length - validRecords.length;

    if (validRecords.length > 0) {
      try {
        const result = await db.insert(salesPointsTable).values(
          validRecords.map(r => ({
            name: r.name,
            location: r.location ?? "",
            notes: r.contactPhone ? `${r.contactName ?? ""} ${r.contactPhone}`.trim() : (r.contactName ?? null),
          }))
        ).returning({ id: salesPointsTable.id });
        imported = result.length;
      } catch (err) {
        errors.push(String(err));
        skipped += validRecords.length;
      }
    }

    res.json({ imported, skipped, errors });
  } catch (error) {
    res.status(500).json({ error: "Failed to import sales points", details: String(error) });
  }
});

export default router;
