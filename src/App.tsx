import React, { useEffect, useRef } from 'react';
import './App.css';
import { useState } from 'react';
import Master from './master.tsx';
import Client from './client.tsx';
import DebugClient from './debug.tsx';

type GameState = "BEFORELOAD" | "TOP" | "MASTER" | "CLIENT" | "DEBUG";
function App() {
  const [gameState, setGameState] = useState<GameState>("BEFORELOAD");
  const [room_id, setRoomId] = useState<number | null>(null);
  const [user_name, setUserName] = useState<string>(() => window.localStorage.getItem("userName") ?? "");
  const [token, setToken] = useState<string>(() => window.localStorage.getItem("token") ?? "");
  useEffect(() => {
    const abortController = new AbortController();
    fetch("api/login.php", {
      method: "POST",
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: token }),
      signal: abortController.signal
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
        } else {
          setGameState("TOP");
        }
      })
      .catch(() => { });
    return () => {
      abortController.abort();
    };
  }, [token]);

  useEffect(() => {
    const f = () => {
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
    };
    f();
    const id = setInterval(f, 10000);
    return () => {
      clearInterval(id);
    };
  }, [token]);

  useEffect(() => {
    const abortController = new AbortController();
    fetch("api/set_user_name.php", {
      method: "POST",
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: token, username: user_name }),
      signal: abortController.signal
    }).catch(() => { });
    return () => {
      abortController.abort();
    };
  }, [token, user_name]);

  const backCallback = () => {
    setGameState("TOP");
    setRoomId(null);
  };

  const dialog_ref = useRef<HTMLDialogElement | null>(null);
  return (
    <div className="App">
      {gameState === "TOP" && <>
        <header id='top_title'>ビンゴゲーム</header>
        <div id="top_start_buttons">
          <button onClick={() => setGameState("MASTER")} className={`top_button`}>部屋を作る</button>
          <button onClick={() => {
            dialog_ref?.current?.showModal();
          }} className={`top_button`}>部屋に入る</button>
          {process.env.NODE_ENV === "development" && <button onClick={() => setGameState("DEBUG")}>debug client</button>}
        </div>
        <dialog id="top_dialog" ref={dialog_ref}>
          <p>ゲームマスターから受け取った部屋IDと、プレイヤー名を入力してください</p>
          <div id='top_dialog_inputs'>
            <label htmlFor='input_room_id'>部屋ID: </label><input id='input_room_id' type='number' min={0} max={999} value={room_id ?? "0"} onChange={e => e.target.validity.valid && setRoomId(parseInt(e.target.value))}></input>
            <label htmlFor='input_player_name'>プレイヤー名: </label><input id='input_player_name' type='text' value={user_name} onChange={e => {
              setUserName(e.target.value);
              window.localStorage.setItem("userName", e.target.value);
            }} required></input>
          </div>
          <form method="dialog">
            <button type='submit' onClick={e => {
              e.preventDefault();
              fetch("api/client_joingame.php", {
                method: "POST",
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: token, room_id, user_name }),
              })
                .then(r => r.json())
                .then(data => {
                  if (data !== null && data.room_id !== null) {
                    setGameState("CLIENT");
                  } else {
                    return Promise.reject("参加が締め切られているか、部屋IDが間違っています。");
                  }
                })
                .catch(e => alert(e));
            }}>OK</button>
            <button type="reset" onClick={() => dialog_ref?.current?.close()}>Cancel</button>
          </form>
        </dialog>
        <footer>(C) 2024 東毛情報開発株式会社</footer>
      </>}
      {gameState === "MASTER" && <><Master token={token} backCallback={backCallback} /></>}
      {gameState === "CLIENT" && <><Client roomId={room_id} token={token} backCallback={backCallback} /></>}
      {gameState === "DEBUG" && <><DebugClient clientNum={30} /></>}
    </div >
  );
}

export default App;
