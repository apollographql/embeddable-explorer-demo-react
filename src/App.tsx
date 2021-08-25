import React, { useEffect } from 'react';
import './App.css';

const EMBEDDABLE_EXPLORER_URL = 'https://embed.apollo.local:3000/?graphRef=acephei@current';

export type JSONPrimitive = boolean | null | string | number;
export type JSONObject = { [key in string]?: JSONValue };
export type JSONValue = JSONPrimitive | JSONValue[] | JSONObject;

async function executeOperation({
  operation,
  operationName,
  variables,
  isSubscription,
}: {
  operation: string,
  operationName?: string,
  variables?: JSONValue,
  isSubscription?: boolean,
}) {
  const response = await fetch(
    "https://acephei-gateway.herokuapp.com",
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: operation,
        variables,
        operationName,
      }),
    },
  )
  return await response.json();
}

export const App = ()=> {

  useEffect(() => {
    const onPostMessageReceived = (event:MessageEvent<{
      name?: string,
      operation?: string,
      operationName?: string,
      variables?: string,
      headers?:string
    }>) => {
      const isQueryOrMutation = event.data.name?.startsWith('ExplorerRequest:');
      const isSubscription = event.data.name?.startsWith('ExplorerSubscriptionRequest:');
      const currentOperationId = event.data.name?.split(':')[1]
      if(isQueryOrMutation || isSubscription) {
        if(event.data.operation){
          executeOperation({
            operation: event.data.operation,
            operationName: event.data.operationName,
            variables: event.data.variables,
          }).then((response) => {
            const embeddedExplorerIFrame = document.getElementById('embedded-explorer') as HTMLIFrameElement;
            embeddedExplorerIFrame?.contentWindow?.postMessage({
              name: isQueryOrMutation ?
                `ExplorerResponse:${currentOperationId}` :
                `ExplorerSubscriptionResponse:${currentOperationId}`,
              response,
            }, EMBEDDABLE_EXPLORER_URL);
          });
        }
      }
    }
    window.addEventListener('message', onPostMessageReceived);

    return () => window.removeEventListener('message', onPostMessageReceived);
  }, [])

  return (
    <div className="App">
      <h1 className="demo-app-title">Apollo's Embedded Explorer Demo App</h1>
      <iframe id="embedded-explorer" className="embedded-explorer-iframe"title="embedded-explorer" src={EMBEDDABLE_EXPLORER_URL}/>
    </div>
  );
}
