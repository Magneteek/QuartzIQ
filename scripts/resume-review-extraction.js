/**
 * Resume Review Extraction Script
 * Re-extracts reviews from businesses that already have placeIds
 * Skips the map search step and goes straight to review extraction
 */

const fs = require('fs').promises;
const path = require('path');
const { UniversalBusinessReviewExtractor } = require('./src/lib/extractor.js');

async function resumeReviewExtraction(extractionId, options = {}) {
    try {
        console.log(`🔄 RESUMING REVIEW EXTRACTION`);
        console.log(`================================\n`);

        // Load the existing extraction data
        const extractionPath = path.join(
            __dirname,
            'data',
            'extraction-history',
            `${extractionId}.json`
        );

        console.log(`📂 Loading extraction: ${extractionId}`);
        const extractionData = JSON.parse(await fs.readFile(extractionPath, 'utf-8'));

        const businesses = extractionData.results.businesses;
        const searchCriteria = extractionData.searchCriteria;

        console.log(`✅ Found ${businesses.length} businesses with placeIds`);
        console.log(`📋 Original category: ${searchCriteria.category}`);
        console.log(`📍 Original location: ${searchCriteria.location}\n`);

        // Filter businesses by rating if needed
        const targetBusinesses = businesses
            .filter(business =>
                business.placeId &&
                business.totalScore &&
                business.totalScore <= (options.maxRating || searchCriteria.maxRating || 4.6) &&
                business.reviewsCount > (options.minReviews || searchCriteria.minReviews || 10)
            )
            .slice(0, options.businessLimit || searchCriteria.businessLimit || businesses.length);

        console.log(`🎯 Targeting ${targetBusinesses.length} businesses for review extraction\n`);

        // Create extractor and run review extraction only
        const extractor = new UniversalBusinessReviewExtractor();
        const allReviews = [];

        for (const business of targetBusinesses) {
            try {
                console.log(`\n📍 Extracting from: ${business.title}`);
                console.log(`   Place ID: ${business.placeId}`);
                console.log(`   Rating: ${business.totalScore}/5 (${business.reviewsCount} reviews)`);

                const reviews = await extractor.extractReviewsFromBusiness(business, {
                    maxStars: options.maxStars || searchCriteria.maxStars || 3,
                    maxReviewsPerBusiness: options.maxReviewsPerBusiness || 5,
                    language: options.language || searchCriteria.language || 'nl',
                    dayLimit: options.dayLimit || searchCriteria.dayLimit || 14
                });

                // Filter for negative reviews
                const negativeReviews = reviews.filter(review =>
                    review.stars <= (options.maxStars || searchCriteria.maxStars || 3)
                );

                console.log(`   ✅ Found ${reviews.length} total, ${negativeReviews.length} negative (≤${options.maxStars || searchCriteria.maxStars || 3} stars)`);
                allReviews.push(...negativeReviews);

                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000));

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }

        console.log(`\n\n📊 EXTRACTION SUMMARY`);
        console.log(`=====================`);
        console.log(`Total businesses processed: ${targetBusinesses.length}`);
        console.log(`Total negative reviews found: ${allReviews.length}`);
        console.log(`Average reviews per business: ${(allReviews.length / targetBusinesses.length).toFixed(1)}\n`);

        // Create updated extraction data
        const updatedExtraction = {
            ...extractionData,
            id: `${extractionId}_resumed_${Date.now()}`,
            timestamp: new Date().toISOString(),
            results: {
                businesses: businesses,
                reviews: allReviews,
                searchCriteria: {
                    ...searchCriteria,
                    ...options,
                    resumed: true,
                    originalExtractionId: extractionId
                },
                extractionDate: new Date()
            },
            metadata: {
                ...extractionData.metadata,
                resumed: true,
                originalExtractionId: extractionId,
                resumedAt: new Date().toISOString()
            }
        };

        // Save the resumed extraction
        const newExtractionPath = path.join(
            __dirname,
            'data',
            'extraction-history',
            `${updatedExtraction.id}.json`
        );

        await fs.writeFile(newExtractionPath, JSON.stringify(updatedExtraction, null, 2));
        console.log(`💾 Saved resumed extraction: ${updatedExtraction.id}`);

        // Update history index
        await updateHistoryIndex(updatedExtraction);

        console.log(`\n✨ RESUME COMPLETE!`);
        console.log(`New extraction ID: ${updatedExtraction.id}`);

        return updatedExtraction;

    } catch (error) {
        console.error(`❌ Resume failed:`, error);
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
            resumed: true,
            originalExtractionId: extraction.metadata.originalExtractionId
        });

        await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
        console.log(`✅ Updated history index`);

    } catch (error) {
        console.error('Failed to update history index:', error);
    }
}

// CLI Usage
if (require.main === module) {
    const extractionId = process.argv[2] || 'extraction_1759997356476_yoy6vwp78';

    const options = {
        maxReviewsPerBusiness: parseInt(process.argv[3]) || 5,
        maxStars: parseInt(process.argv[4]) || 3,
        dayLimit: parseInt(process.argv[5]) || 14
    };

    console.log(`\n🚀 Starting resume extraction...`);
    console.log(`Extraction ID: ${extractionId}`);
    console.log(`Max reviews per business: ${options.maxReviewsPerBusiness}`);
    console.log(`Max stars: ${options.maxStars}`);
    console.log(`Day limit: ${options.dayLimit}\n`);

    resumeReviewExtraction(extractionId, options)
        .then(() => {
            console.log(`\n🎉 All done!`);
            process.exit(0);
        })
        .catch(error => {
            console.error(`\n💥 Failed:`, error);
            process.exit(1);
        });
}

module.exports = { resumeReviewExtraction };
