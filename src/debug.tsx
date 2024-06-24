import React, { useState } from "react";
import Client from "./client.tsx";

export default function DebugClient({ clientNum }: { clientNum: number }) {
    const [room_id, setRoomId] = useState<number>(0);
    const [clients, setClients] = useState<React.JSX.Element[]>([]);
    return (<>
        <input type="number" onChange={e => setRoomId(parseInt(e.target.value))} value={room_id} />
        <button onClick={() => {
            fetch("api/login.php", {
                method: "POST",
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: "" }),
            })
                .then(r => r.json())
                .then(r => {
                    if (r.token === null) {
                        return;
                    }
                    setClients([...clients, <Client roomId={room_id} token={r.token} />]);
                    setInterval(() => {
                        fetch("api/heartbeat.php", {
                            method: "POST",
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ token: r.token }),
                        })
                            .then(r => r.json())
                            .then(r => {
                                if (!r[0]) {
                                    alert("Error: userはタイムアウトしました");
                                }
                            });
                    }, 10000);
                });
        }}>add client</button>
        <div style={{ "display": "flex", "flexWrap": "wrap" }}>
            {clients.map((c) => <div style={{ "border": "1px dotted" }}>
                {c}
            </div>)}
        </div>
    </>);
}