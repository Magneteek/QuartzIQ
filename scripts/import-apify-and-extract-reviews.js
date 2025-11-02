/**
 * Import Apify Dataset and Extract Reviews
 * Fetches businesses from an Apify dataset and runs review extraction
 * Saves API costs by not re-running the expensive map search
 */

const fs = require('fs').promises;
const path = require('path');
const { UniversalBusinessReviewExtractor } = require('./src/lib/extractor.js');

async function fetchApifyDataset(datasetId) {
    const apiToken = process.env.APIFY_API_TOKEN;

    if (!apiToken) {
        throw new Error('APIFY_API_TOKEN not found in environment');
    }

    console.log(`📥 Fetching Apify dataset: ${datasetId}`);

    const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Fetched ${data.length} items from dataset`);

    return data;
}

function convertApifyToBusiness(apifyItem) {
    // Convert Apify Google Maps result to our business format
    return {
        placeId: apifyItem.placeId,
        title: apifyItem.title,
        totalScore: apifyItem.totalScore || apifyItem.rating,
        reviewsCount: apifyItem.reviewsCount || apifyItem.reviews || 0,
        categoryName: apifyItem.categoryName || apifyItem.category,
        address: apifyItem.address,
        city: apifyItem.city,
        postalCode: apifyItem.postalCode || apifyItem.zip,
        state: apifyItem.state,
        countryCode: apifyItem.countryCode,
        location: apifyItem.location,
        phone: apifyItem.phone,
        website: apifyItem.website,
        url: apifyItem.url,
        temporarilyClosed: apifyItem.temporarilyClosed,
        permanentlyClosed: apifyItem.permanentlyClosed
    };
}

async function importApifyAndExtractReviews(datasetId, runId, options = {}) {
    try {
        console.log(`\n🚀 APIFY DATASET IMPORT & REVIEW EXTRACTION`);
        console.log(`==========================================\n`);
        console.log(`📋 Dataset ID: ${datasetId}`);
        console.log(`🆔 Run ID: ${runId}\n`);

        // Step 1: Fetch Apify dataset
        const apifyData = await fetchApifyDataset(datasetId);

        if (!apifyData || apifyData.length === 0) {
            throw new Error('No data found in Apify dataset');
        }

        // Step 2: Convert to our business format
        console.log(`\n🔄 Converting Apify data to business format...`);
        const businesses = apifyData.map(convertApifyToBusiness);

        console.log(`✅ Converted ${businesses.length} businesses`);

        // Log sample business to verify format
        if (businesses.length > 0) {
            console.log(`\n📊 Sample business:`);
            console.log(`   Name: ${businesses[0].title}`);
            console.log(`   Place ID: ${businesses[0].placeId}`);
            console.log(`   Rating: ${businesses[0].totalScore}/5`);
            console.log(`   Reviews: ${businesses[0].reviewsCount}`);
        }

        // Step 3: Filter businesses for review extraction
        const minRating = options.minRating || 3.0;
        const minReviews = options.minReviews || 0; // No minimum reviews requirement

        const targetBusinesses = businesses
            .filter(business =>
                business.placeId &&
                business.totalScore &&
                business.totalScore > minRating &&
                business.reviewsCount >= minReviews
            )
            .slice(0, options.businessLimit || 999999); // Process all businesses by default

        console.log(`\n🎯 FILTERING FOR REVIEW EXTRACTION`);
        console.log(`===============================================`);
        console.log(`Total businesses from Apify: ${businesses.length}`);
        console.log(`After filtering (>${minRating} rating, >=${minReviews} reviews): ${targetBusinesses.length}`);
        console.log(`Business limit: ${options.businessLimit || 'ALL (no limit)'}\n`);

        if (targetBusinesses.length === 0) {
            console.log(`⚠️  No businesses match the filtering criteria`);
            console.log(`   Try adjusting maxRating or minReviews settings`);
            return null;
        }

        // Step 4: Extract reviews from each business
        console.log(`\n📝 EXTRACTING REVIEWS`);
        console.log(`=====================\n`);

        const extractor = new UniversalBusinessReviewExtractor();
        const allReviews = [];

        for (let i = 0; i < targetBusinesses.length; i++) {
            const business = targetBusinesses[i];

            try {
                console.log(`\n[${i + 1}/${targetBusinesses.length}] 📍 ${business.title}`);
                console.log(`   Place ID: ${business.placeId}`);
                console.log(`   Rating: ${business.totalScore}/5 (${business.reviewsCount} reviews)`);

                const reviews = await extractor.extractReviewsFromBusiness(business, {
                    maxStars: options.maxStars || 3,
                    maxReviewsPerBusiness: options.maxReviewsPerBusiness || 2,
                    language: options.language || 'nl',
                    dayLimit: options.dayLimit || 14
                });

                // Apply date filtering
                const dayLimit = options.dayLimit || 14;
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - dayLimit);

                // Filter for negative reviews AND within date range
                const negativeReviews = reviews.filter(review =>
                    review.stars <= (options.maxStars || 3) &&
                    new Date(review.publishedAtDate) >= cutoffDate
                );

                console.log(`   ✅ Found ${reviews.length} total, ${negativeReviews.length} negative (≤${options.maxStars || 3} stars, last ${dayLimit} days)`);
                allReviews.push(...negativeReviews);

                // Rate limiting to avoid API throttling
                if (i < targetBusinesses.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        console.log(`\n\n📊 EXTRACTION SUMMARY`);
        console.log(`=====================`);
        console.log(`Total businesses processed: ${targetBusinesses.length}`);
        console.log(`Total negative reviews found: ${allReviews.length}`);
        console.log(`Average reviews per business: ${(allReviews.length / targetBusinesses.length).toFixed(1)}\n`);

        // Step 5: Create extraction record
        const extractionId = `extraction_imported_apify_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const extraction = {
            id: extractionId,
            timestamp: new Date().toISOString(),
            results: {
                businesses: businesses, // All businesses from Apify
                reviews: allReviews,    // Only negative reviews
                searchCriteria: {
                    category: options.category || 'imported',
                    location: options.location || 'Apify Import',
                    countryCode: options.countryCode || 'nl',
                    minRating: minRating,
                    minReviews: minReviews,
                    maxStars: options.maxStars || 3,
                    dayLimit: options.dayLimit || 14,
                    businessLimit: options.businessLimit || 50,
                    maxReviewsPerBusiness: options.maxReviewsPerBusiness || 2,
                    language: options.language || 'nl',
                    apifyImport: true,
                    apifyDatasetId: datasetId,
                    apifyRunId: runId
                },
                extractionDate: new Date()
            },
            metadata: {
                source: 'apify_import',
                apifyDatasetId: datasetId,
                apifyRunId: runId,
                importedAt: new Date().toISOString()
            }
        };

        // Step 6: Save extraction
        const extractionPath = path.join(
            __dirname,
            'data',
            'extraction-history',
            `${extractionId}.json`
        );

        await fs.writeFile(extractionPath, JSON.stringify(extraction, null, 2));
        console.log(`💾 Saved extraction: ${extractionId}`);

        // Step 7: Update history index
        await updateHistoryIndex(extraction);

        console.log(`\n✨ IMPORT & EXTRACTION COMPLETE!`);
        console.log(`Extraction ID: ${extractionId}`);
        console.log(`\nYou can now:`);
        console.log(`1. View this extraction in your dashboard history`);
        console.log(`2. Run enrichment to get contact details`);
        console.log(`3. Export to Airtable or Quartz Leads\n`);

        return extraction;

    } catch (error) {
        console.error(`\n❌ Import and extraction failed:`, error);
        throw error;
    }
}

async function updateHistoryIndex(extraction) {
    try {
        const indexPath = path.join(__dirname, 'data', 'extraction-history', 'index.json');
        let index = [];

        try {
            index = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
        } catch (error) {
            console.log('Creating new history index');
        }

        // Add new extraction to index
        index.unshift({
            id: extraction.id,
            timestamp: extraction.timestamp,
            category: extraction.results.searchCriteria.category,
            location: extraction.results.searchCriteria.location,
            businessCount: extraction.results.businesses.length,
            reviewCount: extraction.results.reviews.length,
            apifyImport: true,
            apifyDatasetId: extraction.metadata.apifyDatasetId,
            apifyRunId: extraction.metadata.apifyRunId
        });

        await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
        console.log(`✅ Updated history index`);

    } catch (error) {
        console.error('Failed to update history index:', error);
    }
}

// CLI Usage
if (require.main === module) {
    const datasetId = process.argv[2] || 'Ca3O938o506gMZzrP';
    const runId = process.argv[3] || 'a5FLf3uzXM2t47mNN';

    const options = {
        category: process.argv[4] || 'imported',
        location: process.argv[5] || 'Netherlands',
        minRating: parseFloat(process.argv[6]) || 3.0,
        minReviews: parseInt(process.argv[7]) || 0,
        maxReviewsPerBusiness: parseInt(process.argv[8]) || 2,
        maxStars: parseInt(process.argv[9]) || 3,
        dayLimit: parseInt(process.argv[10]) || 14,
        businessLimit: parseInt(process.argv[11]) || 999999, // Process all businesses by default
        language: process.argv[12] || 'nl',
        countryCode: process.argv[13] || 'nl'
    };

    console.log(`\n🚀 Starting Apify import and review extraction...`);
    console.log(`Dataset ID: ${datasetId}`);
    console.log(`Run ID: ${runId}`);
    console.log(`Category: ${options.category}`);
    console.log(`Location: ${options.location}`);
    console.log(`Min rating for businesses: >${options.minRating}`);
    console.log(`Min reviews required: ${options.minReviews} (no minimum)`);
    console.log(`Max reviews per business: ${options.maxReviewsPerBusiness}`);
    console.log(`Max stars for reviews: ${options.maxStars}`);
    console.log(`Day limit: ${options.dayLimit} days\n`);

    importApifyAndExtractReviews(datasetId, runId, options)
        .then(() => {
            console.log(`\n🎉 All done!`);
            process.exit(0);
        })
        .catch(error => {
            console.error(`\n💥 Failed:`, error);
            process.exit(1);
        });
}

module.exports = { importApifyAndExtractReviews, fetchApifyDataset };
