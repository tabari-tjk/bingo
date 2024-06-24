import React, { useEffect } from 'react';
import './App.css';
import { useState } from 'react';
import Master from './master.tsx';
import Client from './client.tsx';
import DebugClient from './debug.tsx';

type GameState = "TOP" | "MASTER" | "CLIENT" | "DEBUG";
function App() {
  const [gameState, setGameState] = useState<GameState>("TOP");
  const [room_id, setRoomId] = useState<number | null>(null);
  const [token, setToken] = useState<string>(() => window.localStorage.getItem("token") ?? "TOKEN_NOT_FOUND");
  useEffect(() => {
    fetch("api/login.php", {
      method: "POST",
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: token }),
    })
      .then(r => r.json())
      .then(r => {
        if (r.token !== null) {
          window.localStorage.setItem("token", r.token);
          setToken(r.token);
        }
        if (r.room_id !== null) {
          setRoomId(r.room_id);
          switch (r.gm) {
            case true:
              setGameState("MASTER");
              break;
            case false:
              setGameState("CLIENT");
              break;
          }
        }
      });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      fetch("api/heartbeat.php", {
        method: "POST",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: token }),
      })
        .then(r => r.json())
        .then(r => {
          if (!r[0]) {
            alert("Error: userはタイムアウトしました");
          }
        });
    }, 10000);
    return () => {
      clearInterval(id);
    };
  }, [token]);

  return (
    <div className="App">
      {gameState == "TOP" && <>
        <div id='top_title'>ビンゴゲーム</div>
        <div id="top_start_buttons">
          <button onClick={() => setGameState("MASTER")} className={`top_button`}>部屋を作る</button>
          <button onClick={() => setGameState("CLIENT")} className={`top_button`}>部屋に入る</button>
          <button onClick={() => setGameState("DEBUG")}>debug client</button>
        </div>
        {room_id !== null ? <>最後にプレイしたルーム: #{room_id}</> : <></>}
        <footer>(C) 2024 東毛情報開発株式会社</footer>
      </>}
      {gameState == "MASTER" && <><Master token={token} /></>}
      {gameState == "CLIENT" && <><Client roomId={room_id} token={token} /></>}
      {gameState == "DEBUG" && <><DebugClient clientNum={30} /></>}
    </div >
  );
}

export default App;
