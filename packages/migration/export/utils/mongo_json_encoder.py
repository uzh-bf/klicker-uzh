import json
from datetime import datetime
from bson import ObjectId

class MongoDBJSONEncoder(json.JSONEncoder):
    """
    Custom JSON encoder class for MongoDB objects.
    """

    def default(self, obj):
        """
        Override the default method to encode MongoDB objects.
        """
        if isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, datetime):
            #  return obj.isoformat()
            return str(obj)
        else:
            return json.JSONEncoder.default(self, obj)