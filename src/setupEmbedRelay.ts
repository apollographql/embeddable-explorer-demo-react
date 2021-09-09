import "./App.css";
import { SubscriptionClient } from "subscriptions-transport-ws";
import {
  EMBEDDABLE_EXPLORER_URL,
  EXPLORER_LISTENING_FOR_STATE,
  EXPLORER_QUERY_MUTATION_REQUEST,
  EXPLORER_QUERY_MUTATION_RESPONSE,
  EXPLORER_SUBSCRIPTION_REQUEST,
  EXPLORER_SUBSCRIPTION_RESPONSE,
  EXPLORER_SUBSCRIPTION_TERMINATION,
  SET_OPERATION,
} from "./constants";

export type JSONPrimitive = boolean | null | string | number;
export type JSONObject = { [key in string]?: JSONValue };
export type JSONValue = JSONPrimitive | JSONValue[] | JSONObject;

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
  operationId: string;
  operationName?: string;
  variables?: JSONValue;
  headers?: Record<string, string>;
  embeddedExplorerIFrame?: HTMLIFrameElement;
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
        name: EXPLORER_QUERY_MUTATION_RESPONSE,
        operationId,
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
            name: EXPLORER_SUBSCRIPTION_RESPONSE,
            operationId,
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
    if (event.data.name === EXPLORER_SUBSCRIPTION_TERMINATION) {
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
      operationId?: string;
      operationName?: string;
      variables?: string;
      headers?: Record<string, string>;
    }>
  ) => {
    const embeddedExplorerIFrame =
      (document.getElementById("embedded-explorer") as HTMLIFrameElement) ??
      undefined;

    // You can set an operation to show on load by sending a SetOperation message
    if (event.data.name === EXPLORER_LISTENING_FOR_STATE) {
      embeddedExplorerIFrame?.contentWindow?.postMessage(
        {
          name: SET_OPERATION,
          operation: `# Run this first to get an api key
# and set your Authorization header to that api key
mutation Login {
  login(email: $loginEmail)
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
          variables: JSON.stringify({
            bookTripsLaunchIds: ["108", "109"],
            loginEmail: "demo@apollographql.com",
          }),
        },
        EMBEDDABLE_EXPLORER_URL
      );
    }

    const isQueryOrMutation =
      "name" in event.data &&
      event.data.name === EXPLORER_QUERY_MUTATION_REQUEST;
    const isSubscription =
      "name" in event.data && event.data.name === EXPLORER_SUBSCRIPTION_REQUEST;

    if (
      (isQueryOrMutation || isSubscription) &&
      event.data.name &&
      event.data.operation &&
      event.data.operationId
    ) {
      const { operation, operationId, operationName, variables, headers } =
        event.data;
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
