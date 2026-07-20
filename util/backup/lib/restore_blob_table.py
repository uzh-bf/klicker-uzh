#!/usr/bin/env python3
import argparse
import json
from azure.data.tables import TableServiceClient, UpdateMode
from azure.core.credentials import AzureNamedKeyCredential

def main():
    # --- CLI arguments ---
    parser = argparse.ArgumentParser(
        description="Export all entities from an Azure Table Storage table into a JSON file."
    )
    parser.add_argument("--account-name", required=True, help="Azure Storage account name")
    parser.add_argument("--account-key", required=True, help="Azure Storage account key")
    parser.add_argument("--table-name", required=True, help="Name of the Azure Table to export")
    parser.add_argument("--input", required=True, help="Input JSON file path")
    args = parser.parse_args()

    # --- Connect ---
    account_url = f"https://{args.account_name}.table.core.windows.net"
    credential = AzureNamedKeyCredential(args.account_name, args.account_key)
    service = TableServiceClient(endpoint=account_url, credential=credential)
    table_client = service.get_table_client(args.table_name)

    # --- Fetch entities ---
    print(f"[INFO] Parsing entities from dump...")

    # --- Save to JSON ---
    with open(args.input) as f:
        entities = json.load(f)

    # Insert back into table
    for entity in entities:
        table_client.upsert_entity(entity=entity, mode=UpdateMode.REPLACE)

    print(f"✅ Imported {len(entities)} entities to {args.table_name}")

if __name__ == "__main__":
    main()
