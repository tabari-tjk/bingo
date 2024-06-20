import React, { useEffect, useState } from "react";
import { API_SERVER } from "./globals.tsx";
import "./client.css";

export default function Client({ roomId, token }: { "roomId": number | null, "token": string }) {
  const [room_id, setRoomId] = useState<number | null>(roomId);
  const [player_id, setPlayerId] = useState(null);
  const [messages, SetMessages] = useState<string[]>([]);
  const [events, SetEvents] = useState<number[]>([]);
  const [board, SetBoard] = useState<number[] | null>(null);
  const [gameFinished, SetGameFinished] = useState(false);
  const [last_msg, setLastMsg] = useState(0);
  const [last_evt, setLastEvt] = useState(0);
  useEffect(() => {
    if (room_id === null) {
      return;
    }
    {
      // join game
      fetch(API_SERVER + "api/client_joingame.php", {
        method: "POST",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: token, room_id }),
      })
        .then(r => r.json())
        .then(data => {
          if (data !== null && data.room_id !== null) {
            setPlayerId(data.player_id);
            setRoomId(data.room_id);
            SetBoard(data.board);
          } else {
            alert("参加が締め切られているか、部屋IDが間違っています。");
            window.location.reload();
          }
        });
    }
  }, [room_id]);
  useEffect(() => {
    if (room_id === null) {
      return;
    }
    const id = setInterval(() => {
      // update msgs
      const formData = new FormData();
      formData.append('room_id', room_id.toString());
      fetch(API_SERVER + "api/gamestat.php", {
        method: "POST",
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, last_msg, last_evt }),
      })
        .then(r => r.json())
        .then(data => {
          data.messages[0].length > 0 && SetMessages([...messages, ...data.messages[0]]);
          setLastMsg(data.messages[1]);
          data.events[0].length > 0 && SetEvents([...events, ...data.events[0]]);
          setLastEvt(data.events[1]);
          if (data.finished) {
            clearInterval(id);
            SetGameFinished(true);
          }
        });
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [room_id, last_msg, last_evt]);

  useEffect(() => {
    const id = room_id ?? setTimeout(() => {
      let rid_input;
      do {
        rid_input = prompt("ゲームマスターから受け取った部屋IDを入力してください");
        if (rid_input === null) {
          window.location.reload();
        }
      } while (isNaN(parseInt(rid_input)));
      const rid = parseInt(rid_input);
      setRoomId(rid);
    }, 0);
    return () => {
      id ?? clearInterval(id);
    };
  });

  useEffect(() => {
    if (events.length === 0 || board === null) {
      return;
    }
    const choose = events.shift() as number; // SAFETY: lengthはチェック済み
    SetEvents([...events]);
    const idx = board.indexOf(choose);
    if (idx !== -1) {
      board[idx] = -choose;
      SetBoard([...board]);
      //alert("hit: " + choose);
    }
  }, [events]);

  return (
    <div id="client">
      <div id="bingocard">
        <div className="bingocard-head-cell">B</div>
        <div className="bingocard-head-cell">I</div>
        <div className="bingocard-head-cell">N</div>
        <div className="bingocard-head-cell">G</div>
        <div className="bingocard-head-cell">O</div>
        {board !== null ? [...Array(5).keys()].map((x, i) => {
          return [...Array(5).keys()].map((y, i) => {
            const pos = y * 5 + x;
            return <div key={i} className={`bingocard-cell ${board[pos] < 1 ? "hit" : ""}`}>{board[pos] == 0 ? "FREE" : Math.abs(board[pos])}</div>;
          });
        })
          : <></>}
      </div>
      <div id="info">
        あなたのプレイヤーIDは{player_id}です<br />
        部屋IDは#{room_id}です<br />
        {gameFinished ? <>
          <button onClick={() => {
            fetch(API_SERVER + "api/client_leavegame.php", {
              method: "POST",
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ token: token }),
            })
              .then(() => window.location.reload());
          }}>トップへ戻る</button>
        </> : <></>}
      </div>
      <MessageList messages={messages} />
    </div>
  );
}

function MessageList({ messages }: { "messages": string[] }) {
  return (<ul>
    {messages.map((e, i) => [e, i]).reverse().slice(0, 100).map(e => <li key={e[1]} className='fadeIn message'>{e[0]}</li>)}
  </ul>);
}