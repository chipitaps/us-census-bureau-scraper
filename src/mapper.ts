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
    
    // Extract simplified variable information (just IDs and labels, not full nested structure)
    const simplifiedMeasures = measures.map((m: any) => ({
        id: m.id,
        label: m.label,
    }));
    
    const simplifiedDimensions = dimensions.map((d: any) => ({
        id: d.id,
        label: d.item?.label || d.label,
        dimensionType: d.dimension_type?.id || d.dimension_type?.description,
    }));
    
    const variables: Record<string, unknown> = {
        measures: simplifiedMeasures,
        dimensions: simplifiedDimensions,
    };

    // Extract year from table ID if not provided (format: DATASETYEAR.TABLEID, e.g., ACSDT1Y2023.B10010)
    let extractedYear: string | undefined;
    if (table.id && !table.year) {
        const yearMatch = table.id.match(/(\d{4})\./); // Match 4 digits before the dot
        if (yearMatch) {
            extractedYear = yearMatch[1];
        }
    }

    // Year: reference year (when the data refers to)
    // Vintage: release/publication year (version of the estimates)
    const datasetData = metadataContent?.dataset;
    const finalYear = table.year || datasetData?.year || extractedYear || datasetData?.vintage;
    const finalVintage = table.vintage || datasetData?.vintage || datasetData?.year || extractedYear;

    // Get title and replace "Untitled Table" with "Unavailable Table" if present
    const rawTitle = table.title || metadataContent?.title || 'Unavailable Table';
    const finalTitle = rawTitle === 'Untitled Table' ? 'Unavailable Table' : rawTitle;
    
    return {
        tableId: table.id,
        title: finalTitle,
        description: table.description || metadataContent?.description,
        survey: table.survey || datasetData?.name || metadataContent?.dataset?.name,
        universe: table.universe || metadataContent?.universe,
        year: finalYear,
        vintage: finalVintage,
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

