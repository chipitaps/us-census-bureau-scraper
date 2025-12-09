import type { RawCensusTable, OutputCensusTable } from './types.js';

/**
 * Maps a raw Census table to output format
 */
export function mapCensusTable(table: RawCensusTable): OutputCensusTable {
    // Validate required properties
    if (!table || !table.id) {
        throw new Error('Invalid table data: missing required property (id)');
    }

    // Extract metadata from nested structure if needed
    const metadataContent = (table.metadata as any)?.metadataContent || table.metadata;
    const measures = metadataContent?.measures || [];
    const dimensions = metadataContent?.dimensions || [];
    
    // Extract variables/measures information
    const variables: Record<string, unknown> = {
        measures: measures,
        dimensions: dimensions,
    };

    return {
        tableId: table.id,
        title: table.title || metadataContent?.title || 'Untitled Table',
        description: table.description || metadataContent?.description,
        survey: table.survey || metadataContent?.dataset?.name,
        universe: table.universe || metadataContent?.universe,
        year: table.year || table.vintage || metadataContent?.dataset?.vintage,
        vintage: table.vintage || table.year || metadataContent?.dataset?.vintage,
        url: table.url || `https://data.census.gov/table?tid=${table.id}`,
        geography: metadataContent?.dimensions?.find((d: any) => d.dimension_type?.id === 'GEOGRAPHY')?.item?.label,
        variables: variables,
        data: table.data,
        scrapedTimestamp: new Date().toISOString(),
    };
}

/**
 * Maps an array of raw Census tables to output format
 */
export function mapCensusTables(tables: RawCensusTable[]): OutputCensusTable[] {
    return tables.map(mapCensusTable);
}

