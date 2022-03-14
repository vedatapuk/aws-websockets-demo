import * as AWS from "aws-sdk";

const dbClient = new AWS.DynamoDB.DocumentClient(
  {
    apiVersion: "2012-08-10",
    endpoint: "http://0.0.0.0:8000",
    region: "us-east-1",
    accessKeyId: AWS?.config?.credentials?.accessKeyId,
    secretAccessKey: AWS?.config?.credentials?.secretAccessKey,
  }
);

module.exports.onConnect = async (event: any) => {
  const connectionId = event.requestContext.connectionId;
  const putParams = {
    TableName: "web-socket-connections",
    Item: {
      connectionId: connectionId,
    },
  };

  try {
    await dbClient.put(putParams).promise();
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }

  return {
    statusCode: 200,
  };
};

module.exports.onDisconnect = async (event: any) => {
  const connectionId = event.requestContext.connectionId;
  const delParams = {
    TableName: "web-socket-connections",
    Key: {
      connectionId: connectionId,
    },
  };
  try {
    await dbClient.delete(delParams).promise();
  } catch (error) {
    console.log("error-2:: ", error)
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
  return {
    statusCode: 200,
  };
};
module.exports.onBroadcast = async (event: any) => {
  let connectionData;
  try {
    connectionData = await dbClient
      .scan({
        TableName: "web-socket-connections",
        ProjectionExpression: "connectionId",
      })
      .promise();
  } catch (e: any) {
    return { statusCode: 500, body: e.stack };
  }

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint: "http://localhost:3001",
  });

  const postData = JSON.parse(event.body).data;

  const postCalls = connectionData?.Items?.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi
        .postToConnection({ ConnectionId: connectionId, Data: postData })
        .promise();
    } catch (e: any) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await dbClient
          .delete({
            TableName: "web-socket-connections",
            Key: { connectionId },
          })
          .promise();
      } else {
        console.log("-4:: ", e)
        throw e;
      }
    }
  });

  try {
    if (postCalls) await Promise.all(postCalls);
  } catch (e: any) {
    console.log("error-5:: ", e)
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: "Data sent." };
};
