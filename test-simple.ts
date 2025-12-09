/**
 * Simple test script to verify the Census Bureau scraper functionality
 * Run with: npx tsx test-simple.ts
 */

import { searchCensusData, fetchTableData, fetchTableMetadata, fetchAllSearchResults } from './src/api.js';
import { mapCensusTable } from './src/mapper.js';

async function testSearch() {
    console.log('\n=== Testing Search ===');
    try {
        const results = await searchCensusData('population', 3, 0);
        console.log(`✅ Search returned ${results.length} results`);
        if (results.length > 0) {
            console.log('First result:', JSON.stringify(results[0], null, 2));
        }
    } catch (error) {
        console.error('❌ Search failed:', error);
    }
}

async function testTableMetadata() {
    console.log('\n=== Testing Table Metadata ===');
    try {
        const metadata = await fetchTableMetadata('ACSDT1Y2021.B01001');
        console.log('✅ Metadata fetched successfully');
        console.log('Metadata:', JSON.stringify(metadata, null, 2).substring(0, 500) + '...');
    } catch (error) {
        console.error('❌ Metadata fetch failed:', error);
    }
}

async function testTableData() {
    console.log('\n=== Testing Table Data ===');
    try {
        const data = await fetchTableData('ACSDT1Y2021.B01001');
        console.log('✅ Table data fetched successfully');
        console.log('Table ID:', data.id);
        console.log('Has data:', !!data.data);
        console.log('Has metadata:', !!data.metadata);
    } catch (error) {
        console.error('❌ Table data fetch failed:', error);
    }
}

async function testMapper() {
    console.log('\n=== Testing Mapper ===');
    try {
        const data = await fetchTableData('ACSDT1Y2021.B01001');
        const mapped = mapCensusTable(data);
        console.log('✅ Mapping successful');
        console.log('Mapped table:', JSON.stringify(mapped, null, 2).substring(0, 500) + '...');
    } catch (error) {
        console.error('❌ Mapping failed:', error);
    }
}

async function testPagination() {
    console.log('\n=== Testing Pagination ===');
    try {
        const allResults: any[] = [];
        await fetchAllSearchResults('population', 5, (entity) => {
            allResults.push(entity);
            console.log(`  Found entity: ${entity.id || entity.title || 'unknown'}`);
            return Promise.resolve();
        });
        console.log(`✅ Pagination test complete. Total entities: ${allResults.length}`);
    } catch (error) {
        console.error('❌ Pagination test failed:', error);
    }
}

async function main() {
    console.log('🧪 Starting Census Bureau Scraper Tests...\n');
    
    await testSearch();
    await testTableMetadata();
    await testTableData();
    await testMapper();
    await testPagination();
    
    console.log('\n✅ All tests completed!');
}

main().catch(console.error);

