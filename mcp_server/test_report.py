import time

from googleads import ad_manager

client = ad_manager.AdManagerClient.LoadFromStorage(
    "config/googleads.yaml"
)

report_service = client.GetService(
    "ReportService",
    version="v202602"
)

report_downloader = client.GetDataDownloader(
    version="v202602"
)

report_job = {
    "reportQuery": {
        "dimensions": ["DATE"],
        "columns": [
            "AD_SERVER_IMPRESSIONS",
            "AD_SERVER_CLICKS",
            "AD_SERVER_CPM_AND_CPC_REVENUE"
        ],
        "dateRangeType": "CUSTOM_DATE",
        "startDate": {
            "year": 2026,
            "month": 6,
            "day": 24
        },
        "endDate": {
            "year": 2026,
            "month": 6,
            "day": 30
        }
    }
}

job = report_service.runReportJob(report_job)

print("Report Job ID:", job["id"])

# Wait until the report is complete
while True:
    status = report_service.getReportJobStatus(job["id"])
    print("Status:", status)

    if status == "COMPLETED":
        break

    if status == "FAILED":
        raise Exception("Report generation failed.")

    time.sleep(5)

# Download the report
report_downloader.DownloadReportToFile(
    job["id"],
    "CSV_DUMP",
    open("report.csv", "wb")
)

print("Report downloaded as report.csv")