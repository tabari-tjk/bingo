import React, { useEffect, useState } from "react";
import "./master.css";
import WakeLock from "../wakelock.tsx";

type RoomState = "Joinable" | "StartGame" | "Finished";

class GameState {
    room_id: number | null;
    join_member_num: number;
    room_message: string[];
    last_msg: number;
    room_state: RoomState;
    user_count: number;
    win_user_count: number;
    ready_user_count: number;
    constructor() {
        this.room_id = null;
        this.join_member_num = 0;
        this.room_message = [];
        this.last_msg = 0;
        this.room_state = "Joinable";
        this.user_count = 0;
        this.win_user_count = 0;
        this.ready_user_count = 0;
    }
}

export default function Master({ token, backCallback }: { token: string, backCallback: Function }) {
    const [gameState, setGameState] = useState<GameState>(new GameState());
    useEffect(() => {
        if (gameState.room_id !== null) {
            return;
        }
        const abortController = new AbortController();
        fetch("api/master_newgame.php", {
            method: "POST",
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token }),
            signal: abortController.signal
        })
            .then(r => r.json())
            .then(data => {
                gameState.room_id = data;
                setGameState({ ...gameState });
            })
            .catch(() => { });
        return () => {
            abortController.abort();
        };
    }, [gameState, token]);
    useEffect(() => {
        if (gameState.room_id === null) {
            return;
        }
        const f = () => {
            fetch("api/gamestat.php", {
                method: "POST",
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, last_msg: gameState.last_msg }),
            })
                .then(r => r.json())
                .then(data => {
                    let changed = false;
                    if (gameState.room_state === "Joinable" && !data.joinable) {
                        gameState.room_state = "StartGame";
                        changed = true;
                    }
                    if (gameState.last_msg !== data.messages[1]) {
                        gameState.room_message = [...gameState.room_message, ...data.messages[0]];
                        gameState.last_msg = data.messages[1];
                        changed = true;
                    }
                    if (gameState.user_count !== data.user_count) {
                        gameState.user_count = data.user_count;
                        changed = true;
                    }
                    if (gameState.win_user_count !== data.win_user_count) {
                        gameState.win_user_count = data.win_user_count;
                        changed = true;
                    }
                    if (gameState.ready_user_count !== data.ready_user_count) {
                        gameState.ready_user_count = data.ready_user_count;
                        changed = true;
                    }
                    if (gameState.room_state !== "Finished" && data.finished) {
                        gameState.room_state = "Finished";
                        changed = true;
                    }
                    if (changed) {
                        setGameState({ ...gameState });
                    }
                });
        };
        f();
        const id = setInterval(f, 1000);
        return () => {
            clearInterval(id);
        };
    }, [gameState, token]);

    const [gameStarted, setGameStarted] = useState(false);
    const startGame = () => {
        if (!gameStarted) {
            fetch("api/master_start_game.php", {
                method: "POST",
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: token }),
            }).then(() => {
                gameState.room_state = "StartGame";
                setGameState({ ...gameState });
                setGameStarted(true);
            });
        }
    };
    const endGame = () => {
        // ゲーム終了状態であれば確認なしで解散処理
        if (gameState.room_state === "Finished" || window.confirm(`部屋#${gameState.room_id}を解散しますか？`)) {
            fetch("api/master_close_room.php", {
                method: "POST",
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: token }),
            })
                .then(() => {
                    alert("部屋を解散しました。");
                    backCallback();
                });
        }
    };
    const choose = () => {
        fetch("api/master_choose.php", {
            method: "POST",
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token }),
        });
    };

    return (
        <div id="master_container">
            <header id="master_title">ビンゴゲーム</header>
            <fieldset id="master_control">
                <legend>ゲームマスター用メニュー</legend>
                <p>
                    部屋ID:「{gameState.room_id}」<br />
                    参加人数: {gameState.user_count}人<br />
                    リーチ人数: {gameState.ready_user_count}人<br />
                    ビンゴ人数: {gameState.win_user_count}人
                </p>
                {
                    gameState.room_id !== null && <>
                        {gameState.room_state === "Joinable" && <button onClick={startGame} className="master_button">参加締め切り・ゲーム開始</button>}
                        {gameState.room_state === "StartGame" && <button onClick={choose} className="master_button">抽選</button>}
                        <button onClick={endGame} className="master_button">ルーム解散</button>
                    </>
                }
            </fieldset>
            <MessageList messages={gameState.room_message} />
            {
                //gameState.room_id !== null && <Client roomId={gameState.room_id} token={token} />
            }
            <WakeLock />
        </div>
    );
}

function MessageList({ messages }: { "messages": string[] }) {
    return (<ul className="master_messagelist">
        {messages.map((e, i) => [e, i]).reverse().slice(0, 100).map(e => <li key={e[1]} className='fadeIn'>{e[0]}</li>)}
    </ul>);
}