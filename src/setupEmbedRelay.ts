import "./App.css";
import { SubscriptionClient } from "subscriptions-transport-ws";

export type JSONPrimitive = boolean | null | string | number;
export type JSONObject = { [key in string]?: JSONValue };
export type JSONValue = JSONPrimitive | JSONValue[] | JSONObject;

export const EMBEDDABLE_EXPLORER_URL =
  "https://explorer.embed.apollographql.com/?graphRef=Apollo-Fullstack-Demo-o3tsz8@current&docsPanelState=closed";

const SUBSCRIPTION_TERMINATION = "ExplorerSubscriptionTermination";
const EXPLORER_QUERY_MUTATION_REQUEST = "ExplorerRequest";
const EXPLORER_SUBSCRIPTION_REQUEST = "ExplorerSubscriptionRequest";
const EXPLORER_QUERY_MUTATION_RESPONSE = "ExplorerResponse";
const EXPLORER_SUBSCRIPTION_RESPONSE = "ExplorerSubscriptionResponse";

function getHeadersWithContentType(
  headers: Record<string, string> | undefined
) {
  const headersWithContentType = headers ?? {};
  if (
    Object.keys(headersWithContentType).every(
      (key) => key.toLowerCase() !== "content-type"
    )
  ) {
    headersWithContentType["content-type"] = "application/json";
  }
  return headersWithContentType;
}

async function executeOperation({
  operation,
  operationName,
  variables,
  headers,
  embeddedExplorerIFrame,
  operationId,
}: {
  operation: string;
  operationName?: string;
  variables?: JSONValue;
  headers?: Record<string, string>;
  embeddedExplorerIFrame?: HTMLIFrameElement;
  operationId: string;
}) {
  const response = await fetch(
    "https://apollo-fullstack-tutorial.herokuapp.com/",
    {
      method: "POST",
      headers: getHeadersWithContentType(headers),
      body: JSON.stringify({
        query: operation,
        variables,
        operationName,
      }),
    }
  );
  await response.json().then((response) => {
    embeddedExplorerIFrame?.contentWindow?.postMessage(
      {
        name: `${EXPLORER_QUERY_MUTATION_RESPONSE}:${operationId}`,
        response,
      },
      EMBEDDABLE_EXPLORER_URL
    );
  });
}

async function executeSubscription({
  operation,
  operationName,
  variables,
  headers,
  embeddedExplorerIFrame,
  operationId,
}: {
  operation: string;
  operationName?: string;
  variables?: JSONValue;
  headers?: Record<string, string>;
  embeddedExplorerIFrame?: HTMLIFrameElement;
  operationId: string;
}) {
  const getClient = () => {
    try {
      return new SubscriptionClient(
        "wss://apollo-fullstack-tutorial.herokuapp.com/graphql",
        {
          reconnect: true,
          lazy: true,
          connectionParams: headers ?? {},
        }
      );
    } catch {
      return undefined;
    }
  };
  const client = getClient();

  client
    ?.request({
      query: operation,
      operationName,
      variables: variables ?? undefined,
    })
    .subscribe({
      next(response) {
        embeddedExplorerIFrame?.contentWindow?.postMessage(
          {
            name: `${EXPLORER_SUBSCRIPTION_RESPONSE}:${operationId}`,
            response,
          },
          EMBEDDABLE_EXPLORER_URL
        );
      },
    });

  const checkForSubscriptionTermination = (
    event: MessageEvent<{
      name?: string;
    }>
  ) => {
    if (event.data.name?.startsWith(SUBSCRIPTION_TERMINATION)) {
      client?.unsubscribeAll();
      window.removeEventListener("message", checkForSubscriptionTermination);
    }
  };

  window.addEventListener("message", checkForSubscriptionTermination);
}

export function setupEmbedRelay() {
  const onPostMessageReceived = (
    event: MessageEvent<{
      name?: string;
      operation?: string;
      operationName?: string;
      variables?: string;
      headers?: Record<string, string>;
    }>
  ) => {
    console.log("post message received", event);
    const embeddedExplorerIFrame =
      (document.getElementById("embedded-explorer") as HTMLIFrameElement) ??
      undefined;

    // Embedded Explorer sends us a PM when it has loaded
    if (event.data.name === "ExplorerLoaded") {
      // You can set an operation to show on load by sending a SetOperation message
      embeddedExplorerIFrame?.contentWindow?.postMessage(
        {
          name: "SetOperation",
          operation: `
# Run this first to get an api key
# and set your Authorization header to that api key
mutation Login {
  login
}

query TripsBookedQuery {
  me {
    email
  }
  tripsBooked
}

mutation BookTripsMutation($bookTripsLaunchIds: [ID]!) {
  bookTrips(launchIds: $bookTripsLaunchIds) {
    message
  }
}

subscription TripsBookedSubscription {
  tripsBooked
}
          `,
          variables: JSON.stringify({ bookTripsLaunchIds: ["108", "109"] }),
        },
        EMBEDDABLE_EXPLORER_URL
      );
    }

    const isQueryOrMutation =
      "name" in event.data &&
      event.data.name?.startsWith(`${EXPLORER_QUERY_MUTATION_REQUEST}:`);
    const isSubscription =
      "name" in event.data &&
      event.data.name?.startsWith(`${EXPLORER_SUBSCRIPTION_REQUEST}:`);

    if (
      (isQueryOrMutation || isSubscription) &&
      event.data.name &&
      event.data.operation
    ) {
      const operationId = event.data.name.split(":")[1];
      const { operation, operationName, variables, headers } = event.data;
      if (isQueryOrMutation) {
        executeOperation({
          operation: event.data.operation,
          operationName,
          variables,
          headers,
          embeddedExplorerIFrame,
          operationId,
        });
      } else {
        executeSubscription({
          operation,
          operationName,
          variables,
          headers,
          embeddedExplorerIFrame,
          operationId,
        });
      }
    }
  };
  window.addEventListener("message", onPostMessageReceived);
}
