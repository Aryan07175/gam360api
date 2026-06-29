# How to set up GAM 360 API credentials
# ========================================
# Follow these steps exactly to get your service account key and
# grant it access to your GAM 360 network.

## Step 1 — Create a GCP project (skip if you have one)

1. Go to https://console.cloud.google.com
2. Click "New Project" → name it "gam360-pipeline"
3. Note your Project ID


## Step 2 — Enable the Ad Manager API

1. In GCP Console → APIs & Services → Library
2. Search "Google Ad Manager API"
3. Click Enable


## Step 3 — Create a Service Account

1. GCP Console → IAM & Admin → Service Accounts
2. Click "Create Service Account"
   - Name: gam360-extractor
   - ID:   gam360-extractor
3. Click "Create and Continue"
4. Role: leave blank (permissions come from GAM, not GCP)
5. Click "Done"

6. Click on the service account you just created
7. Go to the "Keys" tab
8. Click "Add Key" → "Create New Key" → JSON
9. Download the JSON file
10. Save it as:  config/service_account.json


## Step 4 — Grant the service account access in GAM 360

This is what makes the SOAP API work. The service account
must be added as a user in your GAM network.

1. Log in to Google Ad Manager 360
   https://admanager.google.com/

2. Go to:  Admin → Access & authorization → API access

3. Check that the API is enabled for your network.
   (If not, click "Enable API access")

4. Go to:  Admin → Access & authorization → Users

5. Click "New user"
   - Name:  GAM API Service Account
   - Email: gam360-extractor@YOUR-PROJECT.iam.gserviceaccount.com
             (copy from the service account page in GCP)
   - Role:  Administrator  (or at minimum "Run reports")

6. Click "Save"


## Step 5 — Fill in googleads.yaml

```yaml
ad_manager:
  network_code: 123456789          # From GAM: Admin → Network settings
  application_name: MyPipeline
  path_to_private_key_file: config/service_account.json
```


## Step 6 — Test the connection

```bash
python -c "
from googleads import ad_manager
client = ad_manager.AdManagerClient.LoadFromStorage('config/googleads.yaml')
svc = client.GetService('NetworkService', version='v202602')
net = svc.getCurrentNetwork()
print('Connected! Network:', net['displayName'], '| Code:', net['networkCode'])
"
```

If you see "Connected!" you're ready to run the pipeline.


## Common errors

### AuthenticationError / invalid_grant
→ The service account email is wrong, or it wasn't added to GAM as a user.
→ Double-check the email in GCP → IAM → Service Accounts.

### PermissionDenied
→ The GAM user role doesn't have "Run reports" permission.
→ Change the user role to Administrator in GAM.

### NetworkCode mismatch
→ Check network_code in googleads.yaml matches what's in GAM → Admin → Network settings.

### SSL / connection errors
→ Run: pip install --upgrade google-auth google-auth-httplib2

## Which columns match the GAM 360 UI

The table below maps GAM dashboard column names to the SOAP API Column enum.
These are already configured in extractor/gam_extractor.py.

GAM Dashboard              SOAP API Column
--------------------------  ------------------------------------
Total revenue               AD_SERVER_CPM_AND_CPC_REVENUE
Impressions                 AD_SERVER_IMPRESSIONS
Clicks                      AD_SERVER_CLICKS
CTR                         AD_SERVER_CTR
eCPM                        AD_SERVER_WITHOUT_CPD_AVERAGE_ECPM
Fill rate                   AD_SERVER_FILL_RATE
Ad requests                 AD_SERVER_AD_REQUESTS
App name                    AD_UNIT_NAME  (dimension)
Date                        DATE          (dimension)
