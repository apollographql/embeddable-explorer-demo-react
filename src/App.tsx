import React, { useEffect } from 'react';
import './App.css';
import { EMBEDDABLE_EXPLORER_URL, setupEmbedRelay } from './setupEmbedRelay';

export type JSONPrimitive = boolean | null | string | number;
export type JSONObject = { [key in string]?: JSONValue };
export type JSONValue = JSONPrimitive | JSONValue[] | JSONObject;

export const App = ()=> {

  useEffect(() => {
    setupEmbedRelay();
  }, [])

  return (
    <div className="App">
      <h1 className="demo-app-title">Apollo's Embedded Explorer Demo App</h1>
      <iframe id="embedded-explorer" className="embedded-explorer-iframe"title="embedded-explorer" src={EMBEDDABLE_EXPLORER_URL}/>
    </div>
  );
}
