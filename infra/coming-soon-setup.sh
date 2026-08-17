#!/usr/bin/env bash
# Create the prod Static Web App and print DNS records for djanora.com.
# Does not touch test-djanora or test-djanora-fe.
#
# Usage:
#   az login
#   ./infra/coming-soon-setup.sh
#
# Optional env:
#   RG=djanora LOCATION=canadacentral NAME=djanora APEX=djanora.com

set -euo pipefail

RG="${RG:-djanora}"
LOCATION="${LOCATION:-canadacentral}"
NAME="${NAME:-djanora}"
APEX="${APEX:-djanora.com}"
WWW="www.${APEX}"

if ! az account show >/dev/null 2>&1; then
  echo "Run az login first." >&2
  exit 1
fi

if ! az group show --name "$RG" >/dev/null 2>&1; then
  echo "Creating resource group $RG in $LOCATION"
  az group create --name "$RG" --location "$LOCATION" >/dev/null
fi

if az staticwebapp show --name "$NAME" --resource-group "$RG" >/dev/null 2>&1; then
  echo "Static Web App $NAME already exists"
else
  echo "Creating Static Web App $NAME"
  az staticwebapp create \
    --name "$NAME" \
    --resource-group "$RG" \
    --location "$LOCATION" \
    --sku Free \
    --output none
fi

HOST=$(az staticwebapp show --name "$NAME" --resource-group "$RG" --query defaultHostname -o tsv)
TOKEN=$(az staticwebapp secrets list --name "$NAME" --resource-group "$RG" --query properties.apiKey -o tsv)

echo
echo "Default host: https://${HOST}"
echo
echo "GitHub secret AZURE_STATIC_WEB_APPS_API_TOKEN (add under Settings → Secrets):"
echo "$TOKEN"
echo
echo "DNS at your registrar (leave test-djanora*.azurewebsites.net unchanged):"
echo "  CNAME  www  →  ${HOST}"
echo "  ALIAS/ANAME or A for @ (apex ${APEX}) — use the values Azure shows after you add the domain"
echo
echo "After DNS is in place:"
echo "  az staticwebapp hostname set --name $NAME --resource-group $RG --hostname $WWW"
echo "  az staticwebapp hostname set --name $NAME --resource-group $RG --hostname $APEX"
echo
echo "Then run GitHub Action: Deploy Coming Soon (workflow_dispatch)."
