import React, { useEffect, useState } from "react";
import "./client.css";
import WakeLock from "./wakelock.tsx";

const linefuncs: ((i: number) => boolean)[] = [
  i => i % 5 == 0,
  i => i % 5 == 1,
  i => i % 5 == 2,
  i => i % 5 == 3,
  i => i % 5 == 4,
  i => Math.floor(i / 5) == 0,
  i => Math.floor(i / 5) == 1,
  i => Math.floor(i / 5) == 2,
  i => Math.floor(i / 5) == 3,
  i => Math.floor(i / 5) == 4,
  i => i % 6 == 0,
  i => i % 4 == 0 && i != 0 && i != 24,
];
function boardToReadyWin(board: number[]) {
  const result = [...Array(25).keys()].fill(0);
  const lines = linefuncs.map(f => board.map((e, i) => [e, i]).filter((_, i) => f(i)));
  lines.forEach(line => {
    const hit_cnt = line.filter(e => e[0] < 1).length;
    if (hit_cnt === 4) {
      line.forEach(i => { if (board[i[1]] < 1) { result[i[1]] |= 1 } });
    }
    if (hit_cnt === 5) {
      line.forEach(i => result[i[1]] |= 2);
    }
  });
  return result;
}

export default function Client({ roomId, token, backCallback }: { "roomId": number | null, "token": string, backCallback: Function }) {
  const [room_id, setRoomId] = useState<number | null>(roomId);
  const [player_id, setPlayerId] = useState(null);
  const [messages, SetMessages] = useState<string[]>([]);
  const [events, SetEvents] = useState<number[]>([]);
  const [board, SetBoard] = useState<number[] | null>(null);
  const [gameFinished, SetGameFinished] = useState(false);
  const [last_msg, setLastMsg] = useState(0);
  const [last_evt, setLastEvt] = useState(0);
  const [playerCounts, setPlayerCounts] = useState([0, 0, 0]);
  useEffect(() => {
    if (room_id === null) {
      return;
    }
    {
      // join game
      fetch("api/client_joingame.php", {
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
            backCallback();
          }
        });
    }
  }, [room_id]);
  useEffect(() => {
    if (room_id === null) {
      return;
    }
    const f = () => {
      // update msgs
      const formData = new FormData();
      formData.append('room_id', room_id.toString());
      fetch("api/gamestat.php", {
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
          setPlayerCounts([data.user_count, data.ready_user_count, data.win_user_count]);
          if (data.finished) {
            clearInterval(id);
            SetGameFinished(true);
          }
        });
    };
    f();
    const id = setInterval(f, 1000);
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
          backCallback();
          return;
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
      setReadyClassName("");
      setWinClassName("");
      //alert("hit: " + choose);
    }
  }, [events]);

  // ヒット・ビンゴの点滅演出同期用ステート
  const [readyClassName, setReadyClassName] = useState("ready");
  const [winClassName, setWinClassName] = useState("win");
  if (readyClassName === "" || winClassName === "") {
    requestAnimationFrame(() => {
      setReadyClassName("ready");
      setWinClassName("win");
    });
  }

  const boardAttr = board !== null ? boardToReadyWin(board) : [...Array(25).keys()].fill(0);
  return (
    <div id="client">
      <header id="client_title">ビンゴゲーム</header>
      <div id="bingocarg_container">
        <table id="bingocard">
          <thead>
            <tr>
              <th className="bingocard-head-cell">B</th>
              <th className="bingocard-head-cell">I</th>
              <th className="bingocard-head-cell">N</th>
              <th className="bingocard-head-cell">G</th>
              <th className="bingocard-head-cell">O</th>
            </tr>
          </thead>
          <tbody>
            {
              board !== null && [...Array(5).keys()].map((x, i) => {
                return <tr key={i}>
                  {[...Array(5).keys()].map((y, i) => {
                    const pos = y * 5 + x;
                    return <td key={i} className={`bingocard-cell ${(boardAttr[pos] & 2) != 0 ? winClassName : (boardAttr[pos] & 1) != 0 ? readyClassName : board[pos] < 1 ? "hit" : ""} ${board[pos] == 0 ? "free" : ""}`}>{board[pos] == 0 ? "FREE" : Math.abs(board[pos])}</td>;
                  })}
                </tr>;
              })
            }
          </tbody>
        </table>
      </div>
      <div id="info">
        あなたのプレイヤーIDは{player_id}です<br />
        部屋IDは#{room_id}です<br />
        参加人数{playerCounts[0]}人のうち、リーチは{playerCounts[1]}人、ビンゴは{playerCounts[2]}人です<br />
        {gameFinished ? <>
          <button onClick={() => {
            fetch("api/client_leavegame.php", {
              method: "POST",
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ token: token }),
            })
              .then(() => backCallback());
          }}>トップへ戻る</button>
        </> : <></>}
      </div>
      <MessageList messages={messages} />
      <WakeLock />
    </div>
  );
}

function MessageList({ messages }: { "messages": string[] }) {
  return (<ul className="client_messagelist">
    {messages.map((e, i) => [e, i]).reverse().slice(0, 100).map(e => <li key={e[1]} className='fadeIn message'>{e[0]}</li>)}
  </ul>);
}

interface HitEffect {
  draw(): React.JSX.Element;
  finished(): boolean;
}