var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var import_functions = require("@azure/functions");

// src/blob.ts
var import_storage_blob = require("@azure/storage-blob");
var blobClient;
function getBlobClient(context) {
  return __async(this, null, function* () {
    if (!blobClient) {
      try {
        const blobServiceClient = new import_storage_blob.BlobServiceClient(
          process.env.MIGRATION_BLOB_EXPORT_CONNECTION_STRING
        );
        blobClient = blobServiceClient.getContainerClient("exports");
      } catch (e) {
        context.error(e);
      }
    }
    return blobClient;
  });
}
var blob_default = getBlobClient;

// src/mongo.ts
var import_mongodb = require("mongodb");
var mongo;
function getMongoDB(context) {
  return __async(this, null, function* () {
    if (!mongo) {
      try {
        const mongoURL = process.env.MIGRATION_MONGO_CONNECTION_STRING;
        const mongoClient = new import_mongodb.MongoClient(mongoURL);
        yield mongoClient.connect();
        mongo = mongoClient.db("klicker-prod");
      } catch (e) {
        context.error(e);
      }
    }
    return mongo;
  });
}
var mongo_default = getMongoDB;

// src/utils.ts
var import_axios = __toESM(require("axios"));
function sendTeamsNotifications(scope, text, context) {
  return __async(this, null, function* () {
    if (process.env.TEAMS_WEBHOOK_URL) {
      try {
        return import_axios.default.post(process.env.TEAMS_WEBHOOK_URL, {
          "@context": "https://schema.org/extensions",
          "@type": "MessageCard",
          themeColor: "0076D7",
          title: `Migration: ${scope}`,
          text: `[${process.env.NODE_ENV}:${scope}] ${text}`
        });
      } catch (e) {
        context.error(e);
      }
    }
    return null;
  });
}

// src/index.ts
var serviceBusTrigger = function(message, context) {
  return __async(this, null, function* () {
    context.log("MigrationV2Export function processing a message", message);
    try {
      const messageData = message;
      yield sendTeamsNotifications(
        "func/migration-v2-export",
        `Started export of KlickerV2 data for '${messageData.originalEmail}' -> '${messageData.newEmail}'`,
        context
      );
      const db = yield mongo_default(context);
      const matchingUsers = yield db.collection("users").find({ email: messageData.originalEmail.toLowerCase() }).toArray();
      if (!(matchingUsers == null ? void 0 : matchingUsers[0])) {
        throw new Error(
          `No matching V2 user found for ${messageData.originalEmail}`
        );
      }
      const matchingUser = matchingUsers[0];
      const exportData = {
        user_id: matchingUser._id.toString(),
        user_email: matchingUser.email,
        sessions: [],
        tags: [],
        questions: [],
        questioninstances: [],
        files: []
      };
      for (const collectionName of [
        "sessions",
        "tags",
        "questions",
        "questioninstances",
        "files"
      ]) {
        const documents = yield db.collection(collectionName).find({ user: matchingUser._id }).toArray();
        exportData[collectionName] = documents;
        context.log(
          `Fetched ${documents.length} documents from collection '${collectionName}' for user '${matchingUser.email}'.`
        );
      }
      exportData.questions = exportData.questions.map((question) => {
        if (question.versions) {
          question.versions = question.versions[question.versions.length - 1];
        }
        return question;
      });
      const blobClient2 = yield blob_default(context);
      const blockBlobClient = blobClient2.getBlockBlobClient(
        `${messageData.newUserId}_${Date.now()}.json`
      );
      yield blockBlobClient.uploadData(Buffer.from(JSON.stringify(exportData)), {
        blockSize: 4 * 1024 * 1024
        // 4MB block size
      });
      yield sendTeamsNotifications(
        "func/migration-v2-export",
        `Successful export for user '${messageData.originalEmail}' (${messageData.newEmail})`,
        context
      );
      return exportData;
    } catch (e) {
      context.error("Something went wrong while exporting data: ", e);
      yield sendTeamsNotifications(
        "func/migration-v2-export",
        `Export of KlickerV2 data failed. Error: ${e.message}`,
        context
      );
      throw new Error("Something went wrong while exporting data");
    }
  });
};
var src_default = serviceBusTrigger;
import_functions.app.serviceBusQueue("MigrationV2Export", {
  connection: "MIGRATION_SERVICE_BUS_CONNECTION_STRING",
  queueName: process.env.MIGRATION_SERVICE_BUS_QUEUE_NAME,
  handler: serviceBusTrigger
});
