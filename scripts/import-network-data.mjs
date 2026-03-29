/**
 * سكريبت استيراد بيانات الشبكة من Excel
 * يُشغَّل بـ: node scripts/import-network-data.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// نحاول استيراد pg من أماكن متعددة
let Client;
try {
  const pg = require('/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg');
  Client = pg.Client;
} catch {
  const pg = await import('pg');
  Client = pg.Client ?? pg.default?.Client;
}

import xlsx from '/home/runner/workspace/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/lib/xlsx.js';

const HOTSPOT_FILE  = '/home/runner/workspace/attached_assets/نقاط_البث_هوتسبوت_جاهز_للرفع_1774822623752.xlsx';
const BROADBAND_FILE = '/home/runner/workspace/attached_assets/نقاط_البث_برودباند_جاهز_للرفع_1774822623716.xlsx';

/* ─── Helpers ─── */
const orNull = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const cleanPhone = (v) => {
  if (!v) return null;
  const s = String(v).replace(/\D/g, '').trim();
  return s.length >= 7 ? s : null;
};
const isClientOwned = (v) => {
  if (!v) return false;
  return String(v).replace(/\s/g, '').includes('العميل');
};
const hotspotType = (v) => String(v ?? '').trim() === 'داخلي' ? 'internal' : 'external';
const parseFee = (v) => {
  if (!v && v !== 0) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
};

/* ─── قراءة الهوتسبوت ─── */
const wbH = xlsx.readFile(HOTSPOT_FILE);
const hRows = xlsx.utils.sheet_to_json(wbH.Sheets[wbH.SheetNames[0]], { header: 1 }).slice(1);

const hotspotData = hRows
  .filter(r => r[0])
  .map(r => ({
    flash_number:    parseInt(r[0]),
    name:            orNull(r[1]) ?? `فلاش ${r[0]}`,
    device_name:     orNull(r[2]),
    hotspot_type:    hotspotType(r[3]),
    location:        orNull(r[4]) ?? 'غير محدد',
    location_url:    orNull(r[5]),
    client_name:     orNull(r[6]),
    client_phone:    cleanPhone(r[7]),
    subscription_fee: parseFee(r[8]),
    is_client_owned: isClientOwned(r[9]),
    notes:           orNull(r[10]),
    ip_address:      orNull(r[11]),
  }));

/* ─── قراءة البرودباند ─── */
const wbB = xlsx.readFile(BROADBAND_FILE);
const bRows = xlsx.utils.sheet_to_json(wbB.Sheets[wbB.SheetNames[0]], { header: 1 }).slice(1);

const broadbandData = bRows
  .filter(r => r[0])
  .map(r => ({
    flash_number:     parseInt(r[0]),
    name:             orNull(r[1]) ?? `فلاش p${r[0]}`,
    client_name:      orNull(r[2]),
    location:         orNull(r[3]) ?? 'غير محدد',
    subscription_name: orNull(r[4]),
    device_name:      orNull(r[5]),
    location_url:     orNull(r[6]),
    client_phone:     cleanPhone(r[7]),
    subscription_fee: parseFee(r[8]),
    is_client_owned:  isClientOwned(r[9]),
  }));

console.log(`Hotspot: ${hotspotData.length} rows`);
console.log(`Broadband: ${broadbandData.length} rows`);

/* ─── الاتصال بقاعدة البيانات ─── */
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL env variable not set');

const client = new Client({ connectionString: DB_URL });
await client.connect();
console.log('Connected to database.');

/* ─── مسح البيانات القديمة ─── */
await client.query('DELETE FROM hotspot_points');
await client.query('DELETE FROM broadband_points');
console.log('Old data cleared.');

/* ─── استيراد الهوتسبوت ─── */
let hOk = 0, hErr = 0;
for (const row of hotspotData) {
  try {
    await client.query(`
      INSERT INTO hotspot_points
        (name, location, status, hotspot_type, flash_number, device_name,
         client_name, client_phone, subscription_fee, ip_address,
         is_client_owned, location_url, notes, created_at, updated_at)
      VALUES ($1,$2,'active',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
    `, [
      row.name, row.location,
      row.hotspot_type, row.flash_number, row.device_name,
      row.client_name, row.client_phone, row.subscription_fee, row.ip_address,
      row.is_client_owned, row.location_url, row.notes,
    ]);
    hOk++;
  } catch (e) {
    hErr++;
    if (hErr <= 5) console.error(`  !! Hotspot ${row.flash_number}: ${e.message}`);
  }
}
console.log(`Hotspot: ${hOk} inserted, ${hErr} failed.`);

/* ─── استيراد البرودباند ─── */
let bOk = 0, bErr = 0;
for (const row of broadbandData) {
  try {
    await client.query(`
      INSERT INTO broadband_points
        (name, location, status, flash_number, subscription_name,
         device_name, client_name, client_phone, subscription_fee,
         location_url, is_client_owned, created_at, updated_at)
      VALUES ($1,$2,'active',$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
    `, [
      row.name, row.location,
      row.flash_number, row.subscription_name,
      row.device_name, row.client_name, row.client_phone,
      row.subscription_fee, row.location_url, row.is_client_owned,
    ]);
    bOk++;
  } catch (e) {
    bErr++;
    if (bErr <= 5) console.error(`  !! Broadband ${row.flash_number}: ${e.message}`);
  }
}
console.log(`Broadband: ${bOk} inserted, ${bErr} failed.`);

/* ─── تحقق نهائي ─── */
const hCount = await client.query('SELECT COUNT(*) as c FROM hotspot_points');
const bCount = await client.query('SELECT COUNT(*) as c FROM broadband_points');
const hSample = await client.query(`
  SELECT flash_number, name, hotspot_type, client_name, client_phone, subscription_fee
  FROM hotspot_points ORDER BY flash_number LIMIT 3
`);
const bSample = await client.query(`
  SELECT flash_number, name, client_name, subscription_name, subscription_fee
  FROM broadband_points ORDER BY flash_number LIMIT 3
`);

console.log(`\n✅ Final counts:`);
console.log(`   hotspot_points:  ${hCount.rows[0].c}`);
console.log(`   broadband_points: ${bCount.rows[0].c}`);
console.log('\nHotspot sample:', JSON.stringify(hSample.rows, null, 2));
console.log('\nBroadband sample:', JSON.stringify(bSample.rows, null, 2));

await client.end();
console.log('\nDone!');
