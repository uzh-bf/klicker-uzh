# import pymongo
import json
import pandas
import logging
import os
import sys
from export_v2_data.utils.mongo_json_encoder import MongoDBJSONEncoder
from bson import ObjectId
from pymongo import MongoClient
from datetime import datetime

# set up logging in terminal
logging.basicConfig(stream=sys.stdout, level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

# set up database connection
database_name = "klicker-prod"
mongo_url = 'mongodb://klicker:klicker@localhost:27017/'
email = input("Enter the email address of the user whose data you want to export: ")


try:
    client = MongoClient(mongo_url)
    db = client[database_name]

    # used to verify whether the exception is raised
    # email = "abc@hotmail.com"
    user_document = db['users'].find_one({"email": f"{email}"})

    if not user_document:
        raise ValueError(f"No user found with this email address: {email}")

    export_data = {
        "user_id": f"{user_document['_id']}",
        "user_email": email,
        "sessions": [],
        "tags": [],
        "questions": [],
        "questioninstances": [],
        "files": []
    }

    related_collections = ['sessions', 'tags', 'questions', 'questioninstances', 'files']
    for collection_name in related_collections:
        documents = list(db[collection_name].find({"user": user_document["_id"]}))
        export_data[collection_name] = documents
        logging.info(f"Fetched {len(documents)} documents from collection '{collection_name}' for user '{email}'.")

    # generate a json file with the user data
    output_directory =  "exported_json_files"

    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
        
    custom_encoder = MongoDBJSONEncoder()
    output_file_path = os.path.join(output_directory, f"exported_data_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.json")
    with open(output_file_path, "w") as output_file:
        json.dump(export_data, output_file, indent=4, default=custom_encoder.encode)
        
        logging.info(f"Data exported successfully for user '{email}'")


except Exception as e:
    logging.error(f"Something went wrong while exporting data of user '{email}': {e}")

