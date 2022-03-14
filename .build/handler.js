"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
const AWS = __importStar(require("aws-sdk"));
const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
    endpoint: "http://0.0.0.0:8000",
    region: "us-east-1",
    accessKeyId: (_b = (_a = AWS === null || AWS === void 0 ? void 0 : AWS.config) === null || _a === void 0 ? void 0 : _a.credentials) === null || _b === void 0 ? void 0 : _b.accessKeyId,
    secretAccessKey: (_d = (_c = AWS === null || AWS === void 0 ? void 0 : AWS.config) === null || _c === void 0 ? void 0 : _c.credentials) === null || _d === void 0 ? void 0 : _d.secretAccessKey,
});
module.exports.onConnect = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const connectionId = event.requestContext.connectionId;
    const putParams = {
        TableName: "web-socket-connections",
        Item: {
            connectionId: connectionId,
        },
    };
    try {
        yield dbClient.put(putParams).promise();
    }
    catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(error),
        };
    }
    return {
        statusCode: 200,
    };
});
module.exports.onDisconnect = (event) => __awaiter(void 0, void 0, void 0, function* () {
    const connectionId = event.requestContext.connectionId;
    const delParams = {
        TableName: "web-socket-connections",
        Key: {
            connectionId: connectionId,
        },
    };
    try {
        yield dbClient.delete(delParams).promise();
    }
    catch (error) {
        console.log("error-2:: ", error);
        return {
            statusCode: 500,
            body: JSON.stringify(error),
        };
    }
    return {
        statusCode: 200,
    };
});
module.exports.onBroadcast = (event) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    let connectionData;
    try {
        connectionData = yield dbClient
            .scan({
            TableName: "web-socket-connections",
            ProjectionExpression: "connectionId",
        })
            .promise();
    }
    catch (e) {
        return { statusCode: 500, body: e.stack };
    }
    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: "2018-11-29",
        endpoint: "http://localhost:3001",
    });
    const postData = JSON.parse(event.body).data;
    const postCalls = (_e = connectionData === null || connectionData === void 0 ? void 0 : connectionData.Items) === null || _e === void 0 ? void 0 : _e.map(({ connectionId }) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield apigwManagementApi
                .postToConnection({ ConnectionId: connectionId, Data: postData })
                .promise();
        }
        catch (e) {
            if (e.statusCode === 410) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                yield dbClient
                    .delete({
                    TableName: "web-socket-connections",
                    Key: { connectionId },
                })
                    .promise();
            }
            else {
                console.log("-4:: ", e);
                throw e;
            }
        }
    }));
    try {
        if (postCalls)
            yield Promise.all(postCalls);
    }
    catch (e) {
        console.log("error-5:: ", e);
        return { statusCode: 500, body: e.stack };
    }
    return { statusCode: 200, body: "Data sent." };
});
//# sourceMappingURL=handler.js.map