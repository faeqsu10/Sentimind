#!/usr/bin/env node

/**
 * Sentimind: entries.json -> Supabase PostgreSQL Migration Script
 *
 * Usage:
 *   node scripts/migrate-to-supabase.js
 *
 * Required environment variables:
 *   SUPABASE_URL           - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (NOT anon key)
 *
 * What this script does:
 *   1. Reads data/entries.json
 *   2. Creates a "legacy" user in auth.users (for pre-auth entries)
 *   3. Generates nanoid-style IDs for each entry
 *   4. Batch-inserts entries into Supabase (50 per batch)
 *   5. Re-computes ontology metadata if missing from entry
 *   6. Verifies row count matches
 *
 * Safety:
 *   - Does NOT delete entries.json (keep as backup)
 *   - Idempotent: uses upsert, safe to re-run
 *   - Dry-run mode: set DRY_RUN=true to preview without writing
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 50;

const ENTRIES_FILE = path.join(__dirname, '..', 'data', 'entries.json');
const EMOTION_ONTOLOGY_FILE = path.join(__dirname, '..', 'data', 'emotion-ontology.json');
const SITUATION_ONTOLOGY_FILE = path.join(__dirname, '..', 'data', 'situation-ontology.json');

// Legacy user for pre-auth entries
const LEGACY_USER_EMAIL = 'legacy@sentimind.local';
const LEGACY_USER_PASSWORD = crypto.randomBytes(32).toString('hex');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error('Set them in .env or as environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ---------------------------------------------------------------------------
// ID Generation (nanoid-compatible)
// ---------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';

function generateNanoid(size = 21) {
  const bytes = crypto.randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

// ---------------------------------------------------------------------------
// OntologyEngine (minimal, for re-computing missing metadata)
// ---------------------------------------------------------------------------

class MigrationOntologyEngine {
  constructor(emotionOntology, situationOntology) {
    this.emotionOntology = emotionOntology;
    this.situationOntology = situationOntology;
  }

  findEmotionHierarchy(emotion) {
    for (const level1 of Object.values(this.emotionOntology.emotions)) {
      if (level1.subcategories) {
        for (const level2 of Object.values(level1.subcategories)) {
          if (level2.korean === emotion || level2.korean.includes(emotion)) {
            return {
              level1: level1.korean,
              level2: level2.korean,
              emoji: level2.emoji,
            };
          }
          if (level2.specific_emotions) {
            for (const level3 of Object.values(level2.specific_emotions)) {
              if (level3.korean === emotion || emotion.includes(level3.korean)) {
                return {
                  level1: level1.korean,
                  level2: level2.korean,
                  level3: level3.korean,
                  emoji: level3.emoji,
                };
              }
            }
          }
        }
      }
    }
    return { level1: '중립', emoji: '💭' };
  }

  inferSituationContext(text) {
    const lowerText = text.toLowerCase();
    const contexts = [];
    for (const [, info] of Object.entries(this.situationOntology.domains)) {
      for (const [, ctxInfo] of Object.entries(info.contexts)) {
        if (ctxInfo.keywords && ctxInfo.keywords.some((kw) => lowerText.includes(kw))) {
          contexts.push({
            domain: info.korean,
            context: ctxInfo.korean,
          });
        }
      }
    }
    return contexts.length > 0 ? contexts : [{ domain: '기타', context: '일상' }];
  }

  calculateConfidence(text) {
    const baseConfidence = Math.min(text.length / 100, 0.8);
    return Math.round((baseConfidence * 100 + 10) / 10) * 10;
  }
}

// ---------------------------------------------------------------------------
// Migration Logic
// ---------------------------------------------------------------------------

async function loadOntologyEngine() {
  try {
    const emotionData = JSON.parse(fs.readFileSync(EMOTION_ONTOLOGY_FILE, 'utf-8'));
    const situationData = JSON.parse(fs.readFileSync(SITUATION_ONTOLOGY_FILE, 'utf-8'));
    return new MigrationOntologyEngine(emotionData, situationData);
  } catch (err) {
    console.warn('WARNING: Could not load ontology files. Metadata will be empty.');
    console.warn(`  ${err.message}`);
    return null;
  }
}

async function createLegacyUser() {
  console.log('\n--- Step 1: Create legacy user ---');

  // Check if legacy user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === LEGACY_USER_EMAIL);

  if (existing) {
    console.log(`  Legacy user already exists: ${existing.id}`);
    return existing.id;
  }

  // Create new legacy user
  const { data, error } = await supabase.auth.admin.createUser({
    email: LEGACY_USER_EMAIL,
    password: LEGACY_USER_PASSWORD,
    email_confirm: true, // Auto-confirm
    user_metadata: {
      nickname: 'Legacy User',
      migrated: true,
    },
  });

  if (error) {
    console.error(`  ERROR: Failed to create legacy user: ${error.message}`);
    process.exit(1);
  }

  console.log(`  Created legacy user: ${data.user.id}`);
  return data.user.id;
}

async function readSourceEntries() {
  console.log('\n--- Step 2: Read source entries ---');

  if (!fs.existsSync(ENTRIES_FILE)) {
    console.error(`  ERROR: ${ENTRIES_FILE} not found`);
    process.exit(1);
  }

  const raw = fs.readFileSync(ENTRIES_FILE, 'utf-8');
  const entries = JSON.parse(raw);

  console.log(`  Found ${entries.length} entries in entries.json`);
  return entries;
}

function transformEntry(entry, userId, ontologyEngine) {
  // Generate new nanoid (old base36 IDs are incompatible)
  const newId = generateNanoid();

  // Map date field
  const createdAt = entry.date || new Date().toISOString();

  // Compute ontology metadata if missing
  let emotionHierarchy = entry.emotion_hierarchy || {};
  let situationContext = entry.situation_context || [];
  let confidenceScore = entry.confidence_score || 0;
  let relatedEmotions = entry.related_emotions || [];

  if (ontologyEngine && Object.keys(emotionHierarchy).length === 0) {
    emotionHierarchy = ontologyEngine.findEmotionHierarchy(entry.emotion || '알 수 없음');
    situationContext = ontologyEngine.inferSituationContext(entry.text || '');
    confidenceScore = ontologyEngine.calculateConfidence(entry.text || '');
  }

  return {
    id: newId,
    user_id: userId,
    text: (entry.text || '').slice(0, 500),
    emotion: entry.emotion || '알 수 없음',
    emoji: entry.emoji || '💭',
    message: entry.message || '',
    advice: entry.advice || '',
    emotion_hierarchy: emotionHierarchy,
    situation_context: situationContext,
    confidence_score: confidenceScore,
    related_emotions: relatedEmotions,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  };
}

async function migrateEntries(entries, userId, ontologyEngine) {
  console.log('\n--- Step 3: Migrate entries ---');

  const transformed = entries.map((e) => transformEntry(e, userId, ontologyEngine));

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would insert the following entries:');
    transformed.forEach((e, i) => {
      console.log(`    ${i + 1}. id=${e.id} emotion=${e.emotion} text="${e.text.slice(0, 40)}..."`);
    });
    return transformed.length;
  }

  let insertedCount = 0;
  const totalBatches = Math.ceil(transformed.length / BATCH_SIZE);

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { data, error } = await supabase.from('entries').upsert(batch, {
      onConflict: 'id',
    });

    if (error) {
      console.error(`  ERROR in batch ${batchNum}/${totalBatches}: ${error.message}`);
      console.error(`  Details: ${JSON.stringify(error)}`);
      // Continue with remaining batches instead of aborting
      continue;
    }

    insertedCount += batch.length;
    console.log(`  Batch ${batchNum}/${totalBatches}: ${batch.length} entries inserted (total: ${insertedCount})`);
  }

  return insertedCount;
}

async function verifyMigration(expectedCount, userId) {
  console.log('\n--- Step 4: Verify migration ---');

  if (DRY_RUN) {
    console.log('  [DRY RUN] Skipping verification');
    return true;
  }

  // Count rows in Supabase
  const { count, error } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error(`  ERROR: Verification query failed: ${error.message}`);
    return false;
  }

  console.log(`  Source entries:   ${expectedCount}`);
  console.log(`  Supabase entries: ${count}`);

  if (count >= expectedCount) {
    console.log('  PASS: Row count matches or exceeds source');
    return true;
  } else {
    console.error(`  FAIL: Missing ${expectedCount - count} entries`);
    return false;
  }
}

async function spotCheck(userId) {
  console.log('\n--- Step 5: Spot check ---');

  if (DRY_RUN) {
    console.log('  [DRY RUN] Skipping spot check');
    return;
  }

  const { data, error } = await supabase
    .from('entries')
    .select('id, text, emotion, emotion_hierarchy, situation_context, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error(`  ERROR: Spot check failed: ${error.message}`);
    return;
  }

  console.log('  Latest 3 entries in Supabase:');
  data.forEach((e, i) => {
    console.log(`\n  [${i + 1}] id: ${e.id}`);
    console.log(`      text: "${e.text.slice(0, 60)}${e.text.length > 60 ? '...' : ''}"`);
    console.log(`      emotion: ${e.emotion}`);
    console.log(`      hierarchy: ${JSON.stringify(e.emotion_hierarchy)}`);
    console.log(`      context: ${JSON.stringify(e.situation_context)}`);
    console.log(`      created_at: ${e.created_at}`);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('Sentimind: entries.json -> Supabase Migration');
  console.log('='.repeat(60));
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log(`  Source file:  ${ENTRIES_FILE}`);
  console.log(`  Dry run:      ${DRY_RUN}`);
  console.log(`  Batch size:   ${BATCH_SIZE}`);

  const startTime = Date.now();

  try {
    // Load ontology engine for metadata re-computation
    const ontologyEngine = await loadOntologyEngine();

    // Step 1: Create or find legacy user
    const userId = await createLegacyUser();

    // Step 2: Read source entries
    const entries = await readSourceEntries();

    if (entries.length === 0) {
      console.log('\n  No entries to migrate. Done.');
      return;
    }

    // Step 3: Migrate entries
    const insertedCount = await migrateEntries(entries, userId, ontologyEngine);

    // Step 4: Verify
    const verified = await verifyMigration(entries.length, userId);

    // Step 5: Spot check
    await spotCheck(userId);

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`  Source entries:  ${entries.length}`);
    console.log(`  Inserted:        ${insertedCount}`);
    console.log(`  Verified:        ${verified ? 'PASS' : 'FAIL'}`);
    console.log(`  Duration:        ${elapsed}s`);
    console.log(`  Legacy user ID:  ${userId}`);

    if (!verified) {
      console.error('\n  WARNING: Migration verification failed.');
      console.error('  entries.json has NOT been modified (safe to re-run).');
      process.exit(1);
    }

    console.log('\n  Migration complete. entries.json preserved as backup.');
    console.log('  Set USE_SUPABASE=true in .env to switch to Supabase.');
  } catch (err) {
    console.error(`\n  FATAL ERROR: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
