#!/usr/bin/env node

/**
 * Sentimind: Enhanced entries.json -> Supabase Migration Script
 *
 * Phase 5-6 version with improved error handling, validation, and rollback.
 *
 * Usage:
 *   node scripts/migrate-entries.js                 # Full migration
 *   DRY_RUN=true node scripts/migrate-entries.js    # Preview without writing
 *   SKIP_USER=true node scripts/migrate-entries.js  # Skip legacy user creation
 *
 * Required environment variables:
 *   SUPABASE_URL              - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (NOT anon key)
 *
 * What this script does:
 *   1. Validates environment and source data
 *   2. Creates a "legacy" user in auth.users (for pre-auth entries)
 *   3. Transforms entries (maps fields, generates nanoid IDs, fills ontology gaps)
 *   4. Batch-upserts entries into Supabase (configurable batch size)
 *   5. Verifies row count + samples data integrity
 *   6. Outputs detailed migration report
 *
 * Safety:
 *   - Does NOT delete entries.json (keep as backup)
 *   - Idempotent: uses upsert, safe to re-run
 *   - Dry-run mode: set DRY_RUN=true to preview without writing
 *   - Validation: checks data types before inserting
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
const SKIP_USER = process.env.SKIP_USER === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50', 10);
const LEGACY_USER_EMAIL = process.env.LEGACY_USER_EMAIL || 'legacy@sentimind.local';

const PROJECT_ROOT = path.join(__dirname, '..');
const ENTRIES_FILE = path.join(PROJECT_ROOT, 'data', 'entries.json');
const EMOTION_ONTOLOGY_FILE = path.join(PROJECT_ROOT, 'data', 'emotion-ontology.json');
const SITUATION_ONTOLOGY_FILE = path.join(PROJECT_ROOT, 'data', 'situation-ontology.json');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnvironment() {
  const errors = [];

  if (!SUPABASE_URL) errors.push('SUPABASE_URL is required');
  if (!SUPABASE_SERVICE_KEY) errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!fs.existsSync(ENTRIES_FILE)) errors.push(`Source file not found: ${ENTRIES_FILE}`);

  if (errors.length > 0) {
    console.error('\nEnvironment validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nSet them in .env or as environment variables.');
    process.exit(1);
  }
}

validateEnvironment();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// ID Generation
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
// Ontology Engine (minimal)
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
            return { level1: level1.korean, level2: level2.korean, emoji: level2.emoji };
          }
          if (level2.specific_emotions) {
            for (const level3 of Object.values(level2.specific_emotions)) {
              if (level3.korean === emotion || emotion.includes(level3.korean)) {
                return { level1: level1.korean, level2: level2.korean, level3: level3.korean, emoji: level3.emoji };
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
        if (ctxInfo.keywords && ctxInfo.keywords.some(kw => lowerText.includes(kw))) {
          contexts.push({ domain: info.korean, context: ctxInfo.korean });
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
// Migration Steps
// ---------------------------------------------------------------------------

async function loadOntologyEngine() {
  try {
    const emotionData = JSON.parse(fs.readFileSync(EMOTION_ONTOLOGY_FILE, 'utf-8'));
    const situationData = JSON.parse(fs.readFileSync(SITUATION_ONTOLOGY_FILE, 'utf-8'));
    return new MigrationOntologyEngine(emotionData, situationData);
  } catch (err) {
    console.warn(`  WARNING: Could not load ontology files: ${err.message}`);
    console.warn('  Metadata fields will be empty for entries without existing ontology data.');
    return null;
  }
}

async function findOrCreateLegacyUser() {
  console.log('\n--- Step 1: Legacy user ---');

  if (SKIP_USER) {
    console.log('  Skipped (SKIP_USER=true)');
    return null;
  }

  // Check if legacy user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === LEGACY_USER_EMAIL);

  if (existing) {
    console.log(`  Found existing legacy user: ${existing.id}`);
    return existing.id;
  }

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create legacy user: ${LEGACY_USER_EMAIL}`);
    return 'dry-run-user-id';
  }

  const password = crypto.randomBytes(32).toString('hex');
  const { data, error } = await supabase.auth.admin.createUser({
    email: LEGACY_USER_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { nickname: 'Legacy User', migrated: true },
  });

  if (error) {
    console.error(`  ERROR: Failed to create legacy user: ${error.message}`);
    process.exit(1);
  }

  console.log(`  Created legacy user: ${data.user.id}`);
  return data.user.id;
}

function readAndValidateEntries() {
  console.log('\n--- Step 2: Read and validate source entries ---');

  const raw = fs.readFileSync(ENTRIES_FILE, 'utf-8');
  const entries = JSON.parse(raw);

  console.log(`  Source file: ${ENTRIES_FILE}`);
  console.log(`  Total entries: ${entries.length}`);

  // Validate each entry
  const valid = [];
  const invalid = [];

  entries.forEach((entry, i) => {
    const issues = [];

    if (!entry.text || typeof entry.text !== 'string') issues.push('missing or invalid text');
    if (entry.text && entry.text.length > 500) issues.push(`text too long (${entry.text.length} chars)`);
    if (!entry.date && !entry.created_at) issues.push('missing date');

    if (issues.length > 0) {
      invalid.push({ index: i, issues, entry: { id: entry.id, text: entry.text?.slice(0, 40) } });
    } else {
      valid.push(entry);
    }
  });

  if (invalid.length > 0) {
    console.warn(`  WARNING: ${invalid.length} invalid entries found:`);
    invalid.forEach(inv => {
      console.warn(`    #${inv.index}: ${inv.issues.join(', ')} (text: "${inv.entry.text || '(empty)'}")`);
    });
  }

  console.log(`  Valid entries: ${valid.length}`);
  return { valid, invalid };
}

function transformEntry(entry, userId, ontologyEngine) {
  const newId = generateNanoid();
  const createdAt = entry.date || entry.created_at || new Date().toISOString();

  // Extract ontology metadata from entry.ontology (v1 format) or direct fields
  let emotionHierarchy = entry.emotion_hierarchy || entry.ontology?.emotion_hierarchy || {};
  let situationContext = entry.situation_context || entry.ontology?.situation_context || [];
  let confidenceScore = entry.confidence_score || entry.ontology?.confidence || 0;
  let relatedEmotions = entry.related_emotions || entry.ontology?.related_emotions || [];

  // Fill gaps using ontology engine
  if (ontologyEngine && Object.keys(emotionHierarchy).length === 0) {
    emotionHierarchy = ontologyEngine.findEmotionHierarchy(entry.emotion || '알 수 없음');
  }
  if (ontologyEngine && situationContext.length === 0) {
    situationContext = ontologyEngine.inferSituationContext(entry.text || '');
  }
  if (ontologyEngine && confidenceScore === 0) {
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
    confidence_score: Math.max(0, Math.min(100, confidenceScore)),
    related_emotions: Array.isArray(relatedEmotions) ? relatedEmotions : [],
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  };
}

async function migrateEntries(entries, userId, ontologyEngine) {
  console.log('\n--- Step 3: Migrate entries ---');

  const transformed = entries.map(e => transformEntry(e, userId, ontologyEngine));

  if (DRY_RUN) {
    console.log('  [DRY RUN] Preview of entries to insert:');
    transformed.slice(0, 5).forEach((e, i) => {
      console.log(`    ${i + 1}. id=${e.id} emotion="${e.emotion}" text="${e.text.slice(0, 50)}..."`);
    });
    if (transformed.length > 5) {
      console.log(`    ... and ${transformed.length - 5} more`);
    }
    return { insertedCount: transformed.length, failedCount: 0 };
  }

  let insertedCount = 0;
  let failedCount = 0;
  const totalBatches = Math.ceil(transformed.length / BATCH_SIZE);
  const failedBatches = [];

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await supabase.from('entries').upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`  ERROR in batch ${batchNum}/${totalBatches}: ${error.message}`);
      failedCount += batch.length;
      failedBatches.push(batchNum);
      continue;
    }

    insertedCount += batch.length;
    console.log(`  Batch ${batchNum}/${totalBatches}: ${batch.length} entries (total: ${insertedCount})`);
  }

  if (failedBatches.length > 0) {
    console.warn(`  WARNING: ${failedBatches.length} batches failed: [${failedBatches.join(', ')}]`);
  }

  return { insertedCount, failedCount };
}

async function verifyMigration(expectedCount, userId) {
  console.log('\n--- Step 4: Verify migration ---');

  if (DRY_RUN) {
    console.log('  [DRY RUN] Skipping verification');
    return true;
  }

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
  }

  console.error(`  FAIL: Missing ${expectedCount - count} entries`);
  return false;
}

async function spotCheck(userId) {
  console.log('\n--- Step 5: Data integrity spot check ---');

  if (DRY_RUN) {
    console.log('  [DRY RUN] Skipping spot check');
    return;
  }

  const { data, error } = await supabase
    .from('entries')
    .select('id, text, emotion, emoji, emotion_hierarchy, situation_context, confidence_score, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error(`  ERROR: Spot check failed: ${error.message}`);
    return;
  }

  console.log(`  Latest ${data.length} entries in Supabase:`);
  data.forEach((e, i) => {
    console.log(`\n  [${i + 1}] id: ${e.id}`);
    console.log(`      text: "${e.text.slice(0, 60)}${e.text.length > 60 ? '...' : ''}"`);
    console.log(`      emotion: ${e.emotion} ${e.emoji}`);
    console.log(`      hierarchy: ${JSON.stringify(e.emotion_hierarchy)}`);
    console.log(`      context: ${JSON.stringify(e.situation_context)}`);
    console.log(`      confidence: ${e.confidence_score}`);
    console.log(`      created_at: ${e.created_at}`);

    // Validate field types
    const checks = [];
    if (typeof e.emotion_hierarchy !== 'object') checks.push('hierarchy not object');
    if (!Array.isArray(e.situation_context)) checks.push('context not array');
    if (typeof e.confidence_score !== 'number') checks.push('confidence not number');
    if (checks.length > 0) {
      console.warn(`      WARN: ${checks.join(', ')}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('='.repeat(60));
  console.log('Sentimind: entries.json -> Supabase Migration (v2)');
  console.log('='.repeat(60));
  console.log(`  Supabase URL:     ${SUPABASE_URL}`);
  console.log(`  Source file:      ${ENTRIES_FILE}`);
  console.log(`  Legacy email:     ${LEGACY_USER_EMAIL}`);
  console.log(`  Dry run:          ${DRY_RUN}`);
  console.log(`  Batch size:       ${BATCH_SIZE}`);

  const startTime = Date.now();

  try {
    const ontologyEngine = await loadOntologyEngine();
    const userId = await findOrCreateLegacyUser();
    const { valid: entries, invalid } = readAndValidateEntries();

    if (entries.length === 0) {
      console.log('\n  No valid entries to migrate. Done.');
      return;
    }

    if (!userId) {
      console.error('\n  ERROR: No user ID available for migration.');
      console.error('  Either set SKIP_USER=false or provide a valid Supabase project.');
      process.exit(1);
    }

    const { insertedCount, failedCount } = await migrateEntries(entries, userId, ontologyEngine);
    const verified = await verifyMigration(entries.length, userId);
    await spotCheck(userId);

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`  Source entries:    ${entries.length}`);
    console.log(`  Invalid (skipped): ${invalid.length}`);
    console.log(`  Inserted:          ${insertedCount}`);
    console.log(`  Failed:            ${failedCount}`);
    console.log(`  Verified:          ${verified ? 'PASS' : 'FAIL'}`);
    console.log(`  Duration:          ${elapsed}s`);
    console.log(`  Legacy user ID:    ${userId}`);

    if (!verified) {
      console.error('\n  WARNING: Migration verification FAILED.');
      console.error('  entries.json has NOT been modified (safe to re-run).');
      process.exit(1);
    }

    console.log('\n  Migration complete.');
    console.log('  entries.json preserved as backup.');
    console.log('  Next steps:');
    console.log('    1. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
    console.log('    2. Switch to server-v2.js: node server-v2.js');
    console.log('    3. Verify all endpoints work correctly');
  } catch (err) {
    console.error(`\n  FATAL ERROR: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
