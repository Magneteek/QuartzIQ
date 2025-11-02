/**
 * Create CSV backups for all 4 dentist datasets
 */

const fs = require('fs').promises;
const path = require('path');

async function createCSVBackups() {
    const datasets = [
        {
            id: '1rKRlQhGgE8NKgSVq',
            file: '/tmp/dataset1-full.json',
            name: 'dentist-amsterdam-run1',
            count: 1064
        },
        {
            id: 'ksaR3CU2gMh5W2IKf',
            file: '/tmp/dataset2-full.json',
            name: 'dentist-amsterdam-run2',
            count: 2045
        },
        {
            id: 'wA7Ky5JbOeJhLN5m9',
            file: '/tmp/dataset3-full.json',
            name: 'best-dentist-amsterdam',
            count: 218
        },
        {
            id: 'SCkpkxNUkbBdfCn1f',
            file: '/tmp/dataset4-full.json',
            name: 'top-dentist-amsterdam',
            count: 218
        }
    ];

    console.log('📊 Creating CSV backups for all dentist datasets...\n');

    for (const dataset of datasets) {
        console.log(`Processing: ${dataset.name} (${dataset.count} businesses)`);

        try {
            // Read JSON data
            const data = JSON.parse(await fs.readFile(dataset.file, 'utf-8'));

            // Create CSV header
            let csv = 'PlaceID,BusinessName,ReviewCount,Rating,City,Address,Phone,Website,Category\n';

            // Add each business
            for (const business of data) {
                const placeId = business.placeId || '';
                const name = (business.title || '').replace(/,/g, ';').replace(/"/g, '""');
                const reviewCount = business.reviewsCount || 0;
                const rating = business.totalScore || 'null';
                const city = (business.city || '').replace(/,/g, ';');
                const address = (business.address || '').replace(/,/g, ';').replace(/"/g, '""');
                const phone = business.phone || '';
                const website = business.website || '';
                const category = (business.categoryName || '').replace(/,/g, ';');

                csv += `"${placeId}","${name}",${reviewCount},${rating},"${city}","${address}","${phone}","${website}","${category}"\n`;
            }

            // Save CSV
            const csvPath = path.join(
                __dirname,
                `backup-${dataset.name}-${dataset.id}.csv`
            );

            await fs.writeFile(csvPath, csv);

            const stats = await fs.stat(csvPath);
            const sizeKB = (stats.size / 1024).toFixed(0);

            console.log(`  ✅ Created: ${csvPath}`);
            console.log(`  📦 Size: ${sizeKB} KB`);
            console.log(`  📊 Businesses: ${data.length}\n`);

        } catch (error) {
            console.error(`  ❌ Error processing ${dataset.name}:`, error.message);
        }
    }

    console.log('✨ All CSV backups created!\n');
}

createCSVBackups()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed:', error);
        process.exit(1);
    });
