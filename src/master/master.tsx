import React, { useEffect, useRef, useState } from "react";
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
    win_users: Set<string>;
    ready_users: Set<string>;
    constructor() {
        this.room_id = null;
        this.join_member_num = 0;
        this.room_message = [];
        this.last_msg = 0;
        this.room_state = "Joinable";
        this.user_count = 0;
        this.win_user_count = 0;
        this.ready_user_count = 0;
        this.win_users = new Set();
        this.ready_users = new Set();
    }
}

type PlayerStatus = {
    player_id: number;
    username: string;
    ready: number;
    win: number;
    ready_turn: number | null;
    win_turn: number | null;
    rank: number | null;
};
type PlayerStatusSortKey = keyof PlayerStatus;

export default function Master({ token, backCallback }: { token: string, backCallback: Function }) {
    const [gameState, setGameState] = useState<GameState>(new GameState());
    const [player_status, setPlayerStatus] = useState<PlayerStatus[]>([]);
    const [status_sort_key, setStatusSortKey] = useState<PlayerStatusSortKey>("rank");
    const [status_sort_order, setStatusSortOrder] = useState<1 | -1>(1);
    const updateAllPlayerStatus = () => {
        // 全体ステータス更新
        fetch("api/master_get_all_players_status.php", {
            method: "POST",
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token }),
        })
            .then(r => r.json())
            .then((data: PlayerStatus[]) => {
                data.sort((a, b) => {
                    if (a[status_sort_key] === null && b[status_sort_key] === null) {
                        return 0;// どちらもnullなら等しいとする
                    }
                    if (a[status_sort_key] === null) {
                        return 1;// aがnullならb
                    }
                    if (b[status_sort_key] === null) {
                        return -1;// bがnullならa
                    }
                    if (typeof a[status_sort_key] === "number" && typeof b[status_sort_key] === "number") {
                        return (a[status_sort_key] - b[status_sort_key]) * status_sort_order; // どちらもnullでないなら通常の比較
                    }
                    if (typeof a[status_sort_key] === "string" && typeof b[status_sort_key] === "string") {
                        return (a[status_sort_key].localeCompare(b[status_sort_key])) * status_sort_order; // どちらもnullでないなら通常の比較
                    }
                    return 0; // numberでもstringでもnullでもないパターンは存在しないと思うが、念のため0を返す
                });
                setPlayerStatus(data);
            })
            .catch(() => { });
    };
    useEffect(() => { updateAllPlayerStatus(); }, [status_sort_key, status_sort_order]);
    const setSortOrder = (key: PlayerStatusSortKey) => {
        if (key === status_sort_key) {
            setStatusSortOrder(status_sort_order < 0 ? 1 : -1);
        } else {
            setStatusSortKey(key);
            setStatusSortOrder(1);
        }
    };

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
                updateAllPlayerStatus();
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
                    if (data.messages && gameState.last_msg !== data.messages[1]) {
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
                updateAllPlayerStatus();
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
    const choosing_dialog_ref = useRef<HTMLDialogElement | null>(null);
    const choose = () => {
        choosing_dialog_ref?.current?.showModal();
        fetch("api/master_choose.php", {
            method: "POST",
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token }),
        })
            .then(r => r.json())
            .then(data => {
                data.ready_players.forEach((p: string) => gameState.ready_users.add(p));
                data.win_players.forEach((p: string) => gameState.win_users.add(p));
                gameState.win_users.forEach(n => gameState.ready_users.delete(n));
                setGameState({ ...gameState });
                updateAllPlayerStatus();
            })
            .finally(() => {
                choosing_dialog_ref?.current?.close();
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
                    リーチ人数: {gameState.ready_user_count}人（{
                        Array.from(gameState.ready_users).join(", ")
                    }）<br />
                    ビンゴ人数: {gameState.win_user_count}人（{
                        Array.from(gameState.win_users).join(", ")
                    }）
                </p>
                {
                    gameState.room_id !== null && <>
                        {gameState.room_state === "Joinable" && <button onClick={startGame} className="master_button">参加締め切り・ゲーム開始</button>}
                        {gameState.room_state === "StartGame" && <button onClick={choose} className="master_button">抽選</button>}
                        <button onClick={endGame} className="master_button">ルーム解散</button>
                    </>
                }
            </fieldset>
            <table id="master_player_status_table">
                <thead>
                    <tr>
                        <th><button onClick={() => setSortOrder("rank")}>順位</button></th>
                        <th><button onClick={() => setSortOrder("username")}>名前</button></th>
                        <th><button onClick={() => setSortOrder("ready")}>リーチ数</button></th>
                        <th><button onClick={() => setSortOrder("win")}>ビンゴ数</button></th>
                        <th><button onClick={() => setSortOrder("ready_turn")}>初リーチ<wbr />ターン</button></th>
                        <th><button onClick={() => setSortOrder("win_turn")}>初ビンゴ<wbr />ターン</button></th>
                    </tr>
                </thead>
                <tbody>
                    {player_status.map(pl => {
                        return (<tr key={pl.player_id}>
                            <td>{pl.rank ?? "-"}</td>
                            <td>{pl.username}</td>
                            <td>{pl.ready}</td>
                            <td>{pl.win}</td>
                            <td>{pl.ready_turn ?? "-"}</td>
                            <td>{pl.win_turn ?? "-"}</td>
                        </tr>);
                    })}
                </tbody>
            </table>
            <MessageList messages={gameState.room_message} />
            {
                //gameState.room_id !== null && <Client roomId={gameState.room_id} token={token} />
            }
            <dialog ref={choosing_dialog_ref}>loading...</dialog>
            <WakeLock />
        </div>
    );
}

function MessageList({ messages }: { "messages": string[] }) {
    return (<ul className="master_messagelist">
        {messages.map((e, i) => [e, i]).reverse().slice(0, 100).map(e => <li key={e[1]} className='fadeIn'>{e[0]}</li>)}
    </ul>);
}