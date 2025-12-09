# Comprehensive Test Suite for US Census Bureau Scraper
# Runs multiple test scenarios and verifies results

$ErrorActionPreference = "Continue"
$testResults = @()

function Run-Test {
    param(
        [string]$TestName,
        [string]$InputFile,
        [string]$ExpectedItems = 1
    )
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Test: $TestName" -ForegroundColor Cyan
    Write-Host "Input: $InputFile" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    # Clean previous run
    if (Test-Path "storage") {
        Remove-Item -Path "storage" -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Run the test
    $startTime = Get-Date
    try {
        $output = apify run --input-file $InputFile 2>&1
        $exitCode = $LASTEXITCODE
        $duration = ((Get-Date) - $startTime).TotalMilliseconds
        
        # Check if dataset was created
        $datasetFiles = Get-ChildItem -Path "storage\datasets\default" -Filter "*.json" -ErrorAction SilentlyContinue
        $itemsFound = if ($datasetFiles) { $datasetFiles.Count } else { 0 }
        
        # Check output logs for success indicators
        $outputText = $output | Out-String
        $successPatterns = @(
            "Processed table",
            "Saved.*items to dataset",
            "Done!"
        )
        $hasSuccess = $successPatterns | ForEach-Object { $outputText -match $_ } | Where-Object { $_ -eq $true } | Measure-Object | Select-Object -ExpandProperty Count
        
        # Verify output quality if dataset exists
        $outputQuality = "Unknown"
        if ($datasetFiles) {
            $latestFile = $datasetFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            try {
                $data = Get-Content $latestFile.FullName | ConvertFrom-Json
                if ($data.tableId -and $data.title -and $data.scrapedTimestamp) {
                    $outputQuality = "Good"
                } else {
                    $outputQuality = "Missing Fields"
                }
            } catch {
                $outputQuality = "Invalid JSON"
            }
        }
        
        $testResult = [PSCustomObject]@{
            TestName = $TestName
            Status = if ($exitCode -eq 0 -and $itemsFound -gt 0 -and $hasSuccess -ge 2) { "✅ PASS" } else { "❌ FAIL" }
            ItemsExpected = $ExpectedItems
            ItemsFound = $itemsFound
            Duration = "$([math]::Round($duration, 0))ms"
            OutputQuality = $outputQuality
            ExitCode = $exitCode
        }
        
        $script:testResults += $testResult
        
        Write-Host "Result: $($testResult.Status)" -ForegroundColor $(if ($testResult.Status -eq "✅ PASS") { "Green" } else { "Red" })
        Write-Host "Items: $itemsFound/$ExpectedItems | Duration: $($testResult.Duration) | Quality: $outputQuality"
        
        return $testResult
    } catch {
        $testResult = [PSCustomObject]@{
            TestName = $TestName
            Status = "❌ ERROR"
            ItemsExpected = $ExpectedItems
            ItemsFound = 0
            Duration = "N/A"
            OutputQuality = "Error: $($_.Exception.Message)"
            ExitCode = -1
        }
        $script:testResults += $testResult
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return $testResult
    }
}

# Build the project first
Write-Host "`n🔨 Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed! Aborting tests." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful!`n" -ForegroundColor Green

# Run all tests
Write-Host "🧪 Starting Comprehensive Test Suite...`n" -ForegroundColor Yellow

# Test 1: Basic table ID
Run-Test -TestName "Test 1: Basic Table ID" -InputFile "test-inputs/test-1-table-id.json" -ExpectedItems 1

# Test 2: Different table ID
Run-Test -TestName "Test 2: Different Table ID" -InputFile "test-inputs/test-2-table-id-different.json" -ExpectedItems 1

# Test 3: Search query
Run-Test -TestName "Test 3: Search Query" -InputFile "test-inputs/test-3-search-query.json" -ExpectedItems 3

# Test 4: Year filter
Run-Test -TestName "Test 4: Year Filter" -InputFile "test-inputs/test-5-year-filter.json" -ExpectedItems 1

# Test 5: Dataset filter (ACS1)
if (Test-Path "test-inputs/test-12-acs1-filter.json") {
    Run-Test -TestName "Test 5: Dataset Filter (ACS1)" -InputFile "test-inputs/test-12-acs1-filter.json" -ExpectedItems 2
}

# Test 6: All filters combined
if (Test-Path "test-inputs/test-11-all-filters.json") {
    Run-Test -TestName "Test 6: All Filters Combined" -InputFile "test-inputs/test-11-all-filters.json" -ExpectedItems 2
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults | Format-Table -AutoSize

$passed = ($testResults | Where-Object { $_.Status -eq "✅ PASS" }).Count
$failed = ($testResults | Where-Object { $_.Status -ne "✅ PASS" }).Count
$total = $testResults.Count

Write-Host ""
Write-Host "Total Tests: $total | Passed: $passed | Failed: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })

if ($failed -eq 0) {
    Write-Host "`n🎉 All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️ Some tests failed. Review results above." -ForegroundColor Yellow
    exit 1
}

