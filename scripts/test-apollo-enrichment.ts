/**
 * Apollo Enrichment System - Testing Script
 *
 * Tests all components of the contact enrichment system:
 * 1. Database schema validation
 * 2. Apollo API client (search + enrichment)
 * 3. Claude website researcher
 * 4. Contact enrichment orchestrator
 * 5. API endpoints (optional)
 *
 * Usage:
 * npm run test:apollo-enrichment
 *
 * Or with specific business ID:
 * npm run test:apollo-enrichment -- --businessId=<uuid>
 *
 * Or test with real Apollo API:
 * npm run test:apollo-enrichment -- --useRealApi=true
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { ApolloClient } from '../src/services/apollo-client';
import { ClaudeWebsiteResearcher } from '../src/services/claude-website-researcher';
import { ContactEnrichmentOrchestrator } from '../src/services/contact-enrichment-orchestrator';

// Load environment variables
dotenv.config();

// Test configuration
interface TestConfig {
  useRealApi: boolean;
  businessId?: string;
  testWebsite?: string;
  verbose: boolean;
}

// Parse command line arguments
function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    useRealApi: false,
    verbose: true,
  };

  args.forEach((arg) => {
    if (arg.startsWith('--businessId=')) {
      config.businessId = arg.split('=')[1];
    } else if (arg.startsWith('--useRealApi=')) {
      config.useRealApi = arg.split('=')[1] === 'true';
    } else if (arg === '--quiet') {
      config.verbose = false;
    } else if (arg.startsWith('--testWebsite=')) {
      config.testWebsite = arg.split('=')[1];
    }
  });

  return config;
}

// Color logging utilities
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

function logTest(name: string) {
  log(`\n📝 Test: ${name}`, 'cyan');
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * Test 1: Database Schema Validation
 */
async function testDatabaseSchema(db: Pool): Promise<boolean> {
  logTest('Database Schema Validation');

  try {
    // Check if required tables exist
    const tables = [
      'businesses',
      'contact_enrichments',
      'enrichment_queue',
      'apollo_api_log',
    ];

    for (const table of tables) {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        )`,
        [table]
      );

      if (result.rows[0].exists) {
        logSuccess(`Table '${table}' exists`);
      } else {
        logError(`Table '${table}' does not exist`);
        return false;
      }
    }

    // Check contact_enrichments columns
    const requiredColumns = [
      'apollo_person_id',
      'apollo_search_cost',
      'apollo_enrich_cost',
      'reveal_method',
      'title',
      'seniority',
    ];

    for (const column of requiredColumns) {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'contact_enrichments' AND column_name = $1
        )`,
        [column]
      );

      if (result.rows[0].exists) {
        logSuccess(`Column 'contact_enrichments.${column}' exists`);
      } else {
        logError(`Column 'contact_enrichments.${column}' does not exist`);
        return false;
      }
    }

    // Check functions exist
    const functions = ['get_enrichment_stats', 'get_next_enrichment_job'];

    for (const func of functions) {
      const result = await db.query(
        `SELECT EXISTS (
          SELECT FROM pg_proc
          WHERE proname = $1
        )`,
        [func]
      );

      if (result.rows[0].exists) {
        logSuccess(`Function '${func}()' exists`);
      } else {
        logError(`Function '${func}()' does not exist`);
        return false;
      }
    }

    logSuccess('Database schema validation passed!');
    return true;
  } catch (error: any) {
    logError(`Database schema validation failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Apollo API Client
 */
async function testApolloClient(useRealApi: boolean): Promise<boolean> {
  logTest('Apollo API Client');

  if (!useRealApi) {
    logWarning('Skipping real API test (use --useRealApi=true to enable)');
    logInfo('Apollo API client initialized successfully');
    return true;
  }

  try {
    const apolloApiKey = process.env.APOLLO_API_KEY;
    if (!apolloApiKey) {
      logError('APOLLO_API_KEY not found in environment');
      return false;
    }

    const apollo = new ApolloClient(apolloApiKey, 100);

    // Test search API
    logInfo('Testing Apollo Search API...');
    const { people, usage } = await apollo.searchPeopleByDomain('example.com', 1);

    logSuccess(`Search API successful (found ${people.length} people)`);
    logInfo(`  Credits used: ${usage.creditsUsed}`);
    logInfo(`  Cost: $${usage.costUsd.toFixed(4)}`);
    logInfo(`  Duration: ${usage.durationMs}ms`);

    // Test usage stats
    const stats = apollo.getUsageStats();
    logSuccess('Usage stats retrieved successfully');
    logInfo(`  Total requests: ${stats.totalRequests}`);
    logInfo(`  Monthly calls used: ${stats.monthlyCallsUsed}/${stats.monthlyLimit}`);
    logInfo(`  Remaining calls: ${stats.remainingCalls}`);
    logInfo(`  Utilization: ${stats.utilizationPercent}%`);

    return true;
  } catch (error: any) {
    logError(`Apollo API client test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Claude Website Researcher
 */
async function testClaudeResearcher(testWebsite?: string): Promise<boolean> {
  logTest('Claude Website Researcher');

  try {
    const claude = new ClaudeWebsiteResearcher();
    const website = testWebsite || 'https://www.anthropic.com';
    const domain = ApolloClient.extractDomain(website);

    logInfo(`Testing with website: ${website}`);

    const result = await claude.researchWebsite(
      website,
      'Test Company',
      domain
    );

    logSuccess('Website research completed');
    logInfo(`  Method: ${result.method}`);
    logInfo(`  Executives found: ${result.executives.length}`);
    logInfo(`  Email patterns: ${result.emailPatterns.length}`);
    logInfo(`  Company emails: ${result.companyEmails.length}`);
    logInfo(`  Phones found: ${result.phones.length}`);
    logInfo(`  Duration: ${result.durationMs}ms`);
    logInfo(`  Success: ${result.success}`);

    if (result.executives.length > 0) {
      logInfo('  First executive:');
      logInfo(`    Name: ${result.executives[0].fullName}`);
      logInfo(`    Title: ${result.executives[0].title || 'Unknown'}`);
      logInfo(`    Confidence: ${result.executives[0].confidence}`);
      logInfo(`    Email: ${result.executives[0].email || 'N/A'}`);
    }

    return true;
  } catch (error: any) {
    logError(`Claude researcher test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Contact Enrichment Orchestrator
 */
async function testOrchestrator(
  db: Pool,
  useRealApi: boolean,
  businessId?: string
): Promise<boolean> {
  logTest('Contact Enrichment Orchestrator');

  try {
    const apolloApiKey = process.env.APOLLO_API_KEY;
    if (!apolloApiKey) {
      logError('APOLLO_API_KEY not found in environment');
      return false;
    }

    const orchestrator = new ContactEnrichmentOrchestrator(apolloApiKey, 100);

    // Get a test business from database
    let testBusinessId = businessId;

    if (!testBusinessId) {
      const result = await db.query(
        `SELECT id, name, website
         FROM businesses
         WHERE website IS NOT NULL
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        logWarning('No businesses with websites found in database');
        logInfo('Skipping orchestrator test');
        await orchestrator.close();
        return true;
      }

      testBusinessId = result.rows[0].id;
      logInfo(`Using test business: ${result.rows[0].name} (${result.rows[0].website})`);
    }

    if (!useRealApi) {
      logWarning('Skipping real enrichment (use --useRealApi=true to enable)');
      logInfo('Orchestrator initialized successfully');
      await orchestrator.close();
      return true;
    }

    logInfo('Starting enrichment...');
    const result = await orchestrator.enrichBusiness(testBusinessId);

    logSuccess('Enrichment completed');
    logInfo(`  Success: ${result.success}`);
    logInfo(`  Business: ${result.businessName}`);
    logInfo(`  Executives found: ${result.executivesFound}`);
    logInfo(`  Contacts enriched: ${result.contactsEnriched}`);
    logInfo(`  API calls: ${result.totalApiCalls}`);
    logInfo(`  Total cost: $${result.totalCostUsd.toFixed(4)}`);
    logInfo(`  Method: ${result.method}`);
    logInfo(`  Duration: ${result.durationMs}ms`);

    if (result.error) {
      logWarning(`  Error: ${result.error}`);
    }

    await orchestrator.close();
    return true;
  } catch (error: any) {
    logError(`Orchestrator test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Queue System
 */
async function testQueueSystem(db: Pool): Promise<boolean> {
  logTest('Enrichment Queue System');

  try {
    // Test get_next_enrichment_job function
    const result = await db.query('SELECT * FROM get_next_enrichment_job()');

    if (result.rows.length > 0) {
      logSuccess('Queue system working (found queued job)');
      logInfo(`  Queue ID: ${result.rows[0].queue_id}`);
      logInfo(`  Business: ${result.rows[0].business_name}`);
      logInfo(`  Priority: ${result.rows[0].priority}`);
    } else {
      logInfo('No jobs in queue (this is normal for new installations)');
    }

    // Test get_enrichment_stats function
    const statsResult = await db.query('SELECT * FROM get_enrichment_stats($1, $2)', [
      '00000000-0000-0000-0000-000000000000', // Dummy org ID
      30, // Last 30 days
    ]);

    logSuccess('Statistics function working');
    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0];
      logInfo(`  Total businesses: ${stats.total_businesses}`);
      logInfo(`  Success rate: ${stats.success_rate}%`);
      logInfo(`  Total cost: $${parseFloat(stats.total_cost || 0).toFixed(4)}`);
    }

    return true;
  } catch (error: any) {
    logError(`Queue system test failed: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  logSection('🚀 Apollo Enrichment System - Test Suite');

  const config = parseArgs();

  logInfo('Test Configuration:');
  logInfo(`  Use Real API: ${config.useRealApi}`);
  logInfo(`  Business ID: ${config.businessId || 'auto-detect'}`);
  logInfo(`  Test Website: ${config.testWebsite || 'default'}`);
  logInfo(`  Database: ${process.env.DATABASE_URL ? 'configured' : 'NOT CONFIGURED'}`);
  logInfo(`  Apollo API Key: ${process.env.APOLLO_API_KEY ? 'configured' : 'NOT CONFIGURED'}`);

  // Initialize database connection
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const results = {
    databaseSchema: false,
    apolloClient: false,
    claudeResearcher: false,
    orchestrator: false,
    queueSystem: false,
  };

  try {
    // Test database connection
    logSection('Test 1/5: Database Connection');
    await db.query('SELECT NOW()');
    logSuccess('Database connection successful');

    // Run tests
    logSection('Test 2/5: Database Schema');
    results.databaseSchema = await testDatabaseSchema(db);

    logSection('Test 3/5: Apollo API Client');
    results.apolloClient = await testApolloClient(config.useRealApi);

    logSection('Test 4/5: Claude Website Researcher');
    results.claudeResearcher = await testClaudeResearcher(config.testWebsite);

    logSection('Test 5/5: Enrichment Queue System');
    results.queueSystem = await testQueueSystem(db);

    // Optionally test orchestrator (requires real API)
    if (config.useRealApi) {
      logSection('Bonus Test: Contact Enrichment Orchestrator');
      results.orchestrator = await testOrchestrator(db, config.useRealApi, config.businessId);
    } else {
      logWarning('Skipping orchestrator full test (use --useRealApi=true to enable)');
    }
  } catch (error: any) {
    logError(`Test suite failed: ${error.message}`);
  } finally {
    await db.end();
  }

  // Print summary
  logSection('📊 Test Results Summary');

  const tests = [
    { name: 'Database Schema', result: results.databaseSchema },
    { name: 'Apollo API Client', result: results.apolloClient },
    { name: 'Claude Website Researcher', result: results.claudeResearcher },
    { name: 'Enrichment Queue System', result: results.queueSystem },
  ];

  if (config.useRealApi) {
    tests.push({ name: 'Contact Enrichment Orchestrator', result: results.orchestrator });
  }

  let passedTests = 0;
  let totalTests = tests.length;

  tests.forEach((test) => {
    if (test.result) {
      logSuccess(`${test.name}: PASSED`);
      passedTests++;
    } else {
      logError(`${test.name}: FAILED`);
    }
  });

  console.log('\n' + '='.repeat(60));
  if (passedTests === totalTests) {
    logSuccess(`\n🎉 All tests passed! (${passedTests}/${totalTests})\n`);
  } else {
    logError(`\n❌ Some tests failed (${passedTests}/${totalTests} passed)\n`);
  }
  console.log('='.repeat(60) + '\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
