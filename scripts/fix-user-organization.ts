/**
 * Fix User Organization Assignment
 * Assign users to organizations for enrichment queue
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fixUserOrganization() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    console.log('🔍 Checking users and organizations...\n');

    // Check users
    const usersResult = await pool.query(`
      SELECT id, name, email, role, organization_id
      FROM users
      ORDER BY created_at
    `);

    console.log('👥 Users found:');
    usersResult.rows.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name} (${user.email})`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Org ID: ${user.organization_id || '❌ NOT SET'}`);
      console.log('');
    });

    // Check organizations
    const orgsResult = await pool.query(`
      SELECT id, name, created_at
      FROM organizations
      ORDER BY created_at
    `);

    console.log('🏢 Organizations found:');
    if (orgsResult.rows.length === 0) {
      console.log('  ❌ No organizations exist!\n');

      // Create a default organization
      console.log('Creating default organization...');
      const newOrg = await pool.query(`
        INSERT INTO organizations (name, slug, settings)
        VALUES ($1, $2, $3)
        RETURNING *
      `, ['QuartzIQ', 'quartziq', '{}']);

      console.log(`✅ Created organization: ${newOrg.rows[0].name} (ID: ${newOrg.rows[0].id})\n`);
      orgsResult.rows.push(newOrg.rows[0]);
    } else {
      orgsResult.rows.forEach((org, i) => {
        console.log(`  ${i + 1}. ${org.name} (ID: ${org.id})`);
      });
      console.log('');
    }

    // Assign users without organization to the first org
    const usersWithoutOrg = usersResult.rows.filter(u => !u.organization_id);

    if (usersWithoutOrg.length > 0 && orgsResult.rows.length > 0) {
      const defaultOrg = orgsResult.rows[0];

      console.log(`\n🔧 Assigning ${usersWithoutOrg.length} users to organization: ${defaultOrg.name}...\n`);

      for (const user of usersWithoutOrg) {
        await pool.query(`
          UPDATE users
          SET organization_id = $1
          WHERE id = $2
        `, [defaultOrg.id, user.id]);

        console.log(`  ✅ ${user.name} → ${defaultOrg.name}`);
      }

      console.log('\n✅ All users assigned to organizations!');
    } else if (usersWithoutOrg.length === 0) {
      console.log('✅ All users already have organizations assigned!');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixUserOrganization();
