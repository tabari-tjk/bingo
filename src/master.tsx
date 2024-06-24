import React, { useEffect, useState } from "react";

class GameState {
    room_id: number | null;
    join_member_num: number;
    room_status: string[];
    constructor() {
        this.room_id = null;
        this.join_member_num = 0;
        this.room_status = [];
    }
}

export default function Master({ token }: { token: string }) {
    const [gameState, setGameState] = useState<GameState>(new GameState());
    useEffect(() => {
        fetch("api/master_newgame.php", {
            method: "POST",
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: token }),
        })
            .then(r => r.json())
            .then(data => {
                gameState.room_id = data;
                setGameState({ ...gameState });
            });
    }, []);
    useEffect(() => {
        if (gameState.room_id === null) {
            return;
        }
        const id = setInterval(() => {
            fetch("api/gamestat.php", {
                method: "POST",
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: token }),
            })
                .then(r => r.json())
                .then(data => {
                    gameState.room_status = data.messages[0];
                    setGameState({ ...gameState });
                });
        }, 1000);
        return () => {
            clearInterval(id);
        };
    }, [gameState.room_id]);

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
            }).then(() => setGameStarted(true));
        }
    };
    const endGame = () => {
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
                window.location.reload();
            });
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
        <div>
            部屋ID:{gameState.room_id}
            {
                gameState.room_id !== null && <>
                    <button onClick={startGame}>参加締め切り・ゲーム開始</button>
                    <button onClick={choose}>抽選</button>
                    <button onClick={endGame}>ルーム解散</button>
                    <MessageList messages={gameState.room_status} />
                </>
            }
        </div>
    );
}

function MessageList({ messages }: { "messages": string[] }) {
    return (<ul>
        {messages.map((e, i) => [e, i]).reverse().slice(0, 100).map(e => <li key={e[1]} className='fadeIn'>{e[0]}</li>)}
    </ul>);
}