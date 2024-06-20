import React from "react";
import App from "./App";
import Client from "./client.tsx";

export default function DebugClient({ clientNum }: { clientNum: number }) {
    return (<>
        <button onClick={() => {
            window.location.reload();
        }}>back</button>
        {[...Array(clientNum).keys()].map(() => <>
            <iframe src={window.location.href} ></iframe>
        </>)}
    </>);
}