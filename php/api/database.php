<?php

// TODO: 削除までの時間を再検討
const ROOM_INVALIDATE_SECS = 60;
const USER_INVALIDATE_SECS = 60;

class DataBase
{
    private $db;
    function __construct()
    {
        // DBオープン
        $this->db = new SQLite3('db.sqlite3');
        $this->db->busyTimeout(1000000);
        $this->db->exec('PRAGMA journal_mode = WAL');
        // テーブル作成
        $this->db->exec('CREATE TABLE IF NOT EXISTS room(id INTEGER PRIMARY KEY AUTOINCREMENT, last_access_time integer, joinable integer, finished integer)');
        $this->db->exec("CREATE table if not exists room_message(id integer primary key autoincrement, room_id integer not null, msg text)");
        $this->db->exec('CREATE TABLE IF NOT EXISTS user(token text primary key, last_access_time integer, room_id integer, player_id integer, is_gm integer, win integer)');
        $this->db->exec('CREATE TABLE IF NOT EXISTS bingocard(token text, pos integer not null, bingo_number integer, primary key(token, pos))');
        $this->db->exec('CREATE TABLE IF NOT EXISTS bingochoosed(id integer primary key autoincrement, room_id integer, bingo_number integer)');

        $this->db->exec('begin');
        // USER_INVALIDATE_SECS秒間ハートビートのないユーザを削除
        $this->db->exec("DELETE from user where last_access_time < " . (time() - USER_INVALIDATE_SECS));
        // ユーザのいない部屋を削除
        $this->db->exec("DELETE from room_message where not exists (select room_id from user where user.room_id = room_message.room_id)");
        $this->db->exec("DELETE from room where not exists (select room_id from user where user.room_id = room.id)");
        $this->db->exec("DELETE from bingochoosed where not exists (select room_id from user where user.room_id = bingochoosed.room_id)");
        $this->db->exec("DELETE from bingocard where not exists (select token from user where user.token = bingocard.token)");
        $this->db->exec('commit');
    }
    function get_db()
    {
        return $this->db;
    }

    /// 有効な部屋IDの取得
    function get_active_room_ids()
    {
        $active_ids = [];
        $results = $this->db->query("SELECT id from room;");
        while ($row = $results->fetchArray()) {
            array_push($active_ids, $row[0]);
        }
        return $active_ids;
    }

    // ルームの存在チェック
    function is_room_exist(int $room_id)
    {
        $results = $this->db->querySingle("SELECT count(*) from room where id = " . $room_id);
        return $results !== false && $results !== 0;
    }

    // ルームの参加可能チェック
    function is_room_joinable(int $room_id)
    {
        $results = $this->db->querySingle("SELECT joinable from room where id = " . $room_id);
        return $results !== false && $results !== 0;
    }

    // ルーム終了チェック（GM退出）
    function is_room_finished(int $room_id)
    {
        $results = $this->db->querySingle("SELECT finished from room where id = " . $room_id);
        return $results !== false && $results !== 0;
    }

    // ルーム終了（GM退出）
    function room_finish(int $room_id)
    {
        // 部屋に終了フラグを立てる
        $this->db->exec("UPDATE room set finished = 1 where id = " . $room_id);
    }

    // 新しい部屋の作成
    function create_new_room_id(string $token)
    {
        if (!$this->is_user_exist($token)) {
            return null;
        }
        $ids = $this->get_active_room_ids();
        if (count($ids) >= 1000) {
            return null;
        }
        do {
            $room_id = rand() % 1000;
        } while (!$this->db->exec("INSERT into room(id, last_access_time, joinable, finished) values(" . $room_id . ", " . time() . ", 1, 0)"));

        $stmt = $this->db->prepare("UPDATE user set room_id = :room_id, is_gm = 1, player_id = 0 where token = :token");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $stmt->execute();
        return $room_id;
    }

    // 部屋ハートビート
    function heartbeat_room(int $room_id)
    {
        return $this->db->exec("UPDATE room set last_access_time = " . time() . " where id = " . $room_id);
    }

    // ユーザハートビート
    function heartbeat_user(string $token)
    {
        $stmt = $this->db->prepare("UPDATE user set last_access_time = :last_access_time where token = :token");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $stmt->bindValue(':last_access_time', time(), SQLITE3_INTEGER);
        $result = $stmt->execute();
        return !!$result;
    }

    // 部屋メッセージ取得
    function get_room_messages(int $room_id, int $create_time = 0)
    {
        $msgs = [];
        $results = $this->db->query("SELECT msg, id from room_message where room_id = " . $room_id . " and id > " . $create_time . " order by id asc");
        if ($results === false) {
            return null;
        }
        while ($row = $results->fetchArray()) {
            array_push($msgs, $row[0]);
            $create_time = max($create_time, $row[1]);
        }
        return [$msgs, $create_time];
    }

    // 部屋メッセージ追加
    function add_room_message(int $room_id, string $message)
    {
        $stmt = $this->db->prepare("INSERT into room_message(room_id, msg) values(:room_id, :msg)");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $stmt->bindValue(':msg', $message, SQLITE3_TEXT);
        $stmt->execute();
    }

    // 出た目を記録するイベント追加
    function add_bingo_event(int $room_id, int $bingo_number)
    {
        $stmt = $this->db->prepare("INSERT into bingochoosed(room_id, bingo_number) values(:room_id, :bingo_number)");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $stmt->bindValue(':bingo_number', $bingo_number, SQLITE3_INTEGER);
        $stmt->execute();
    }

    /// 指定時刻以降のイベントの取得
    function get_bingo_events(int $room_id, int $create_time = 0)
    {
        $events = [];
        $stmt = $this->db->prepare("SELECT bingo_number, id from bingochoosed where room_id = :room_id and id > :create_time order by id asc");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $stmt->bindValue(':create_time', $create_time, SQLITE3_INTEGER);
        $results = $stmt->execute();
        while ($row = $results->fetchArray()) {
            array_push($events, $row[0]);
            $create_time = max($create_time, $row[1]);
        }
        return [$events, $create_time];
    }

    // ユーザ存在チェック
    function is_user_exist(string $token)
    {
        $stmt = $this->db->prepare("select count(*) from user where token = :token");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $result = $stmt->execute();
        return $result !== false && $result->fetchArray()[0] == 1;
    }

    // ユーザがGMかチェック
    function is_user_gm(string $token)
    {
        $stmt = $this->db->prepare("select count(*) from user where token = :token and is_gm = 1");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $result = $stmt->execute();
        return $result !== false && $result->fetchArray()[0] == 1;
    }

    // ユーザが入室中の部屋IDを取得
    function get_user_room_id(string $token)
    {
        $stmt = $this->db->prepare("SELECT room_id from user where token = :token and room_id is not null");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $result = $stmt->execute();
        if ($result === false) {
            return null;
        }
        $result = $result->fetchArray();
        if ($result === false) {
            return null;
        }
        return $result[0];
    }

    // ユーザを退出させる
    function user_leave_room(string $token)
    {
        $stmt = $this->db->prepare("DELETE from bingocard where token = :token");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $stmt->execute();
        $stmt = $this->db->prepare("UPDATE user set is_gm = 0, player_id = null, room_id = null where token = :token");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $result = $stmt->execute();
        return $result !== false && $result->fetchArray()[0] == 1;
    }

    // ユーザ新規作成
    function create_new_user(string $token)
    {
        $this->db->exec('begin');
        $stmt = $this->db->prepare("INSERT into user(token, last_access_time, room_id, player_id, is_gm, win)"
            . " values(:token, :last_access_time, NULL, NULL, 0, 0)");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $stmt->bindValue(':last_access_time', time(), SQLITE3_INTEGER);
        $result = $stmt->execute();
        if ($result !== false) {
            $this->db->exec('commit');
        } else {
            $this->db->exec('rollback');
        }
        return $result !== false;
    }

    // 部屋に入る
    function join_room(string $token, int $room_id)
    {
        if (!$this->is_user_exist($token)) {
            return null;
        }
        if (!$this->is_room_exist($room_id)) {
            return null;
        }
        if (!$this->is_room_joinable($room_id)) {
            return null;
        }
        $stmt = $this->db->prepare("UPDATE user set room_id = :room_id, player_id = (select max(player_id) from user where room_id = :room_id)+1, is_gm = 0, win = 0 where token = :token");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $result = $stmt->execute();
        if ($result === false) {
            return null;
        }
        $player_id = $this->get_player_id($token);
        $this->create_bingo_card($token);

        return $player_id;
    }

    // プレイヤー存在チェック
    function get_player_id(string $token)
    {
        if (!$this->is_user_exist($token)) {
            return null;
        }
        $stmt = $this->db->prepare("SELECT player_id from user where token = :token and room_id is not null");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $result = $stmt->execute();
        if ($result === false) {
            return null;
        }
        $result = $result->fetchArray();
        if ($result === false) {
            return null;
        }

        return $result[0];
    }

    // 参加締め切り・ゲーム開始
    function start_game(int $room_id)
    {
        if (!$this->is_room_exist($room_id)) {
            return null;
        }
        if (!$this->is_room_joinable($room_id)) {
            return null;
        }
        // 参加可能フラグを折る
        $stmt = $this->db->prepare("UPDATE room set joinable = 0 where id = :room_id");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $stmt->execute();
        return true;
    }

    // ビンゴカード作成
    function create_bingo_card(string $token)
    {
        if ($this->get_player_id($token) === null) {
            return false;
        }
        // 新規カードをランダムに作成
        $b = array_slice(array_shuffle(range(1, 15)), 0, 5);
        $i = array_slice(array_shuffle(range(16, 30)), 0, 5);
        $n = array_slice(array_shuffle(range(31, 45)), 0, 5);
        $g = array_slice(array_shuffle(range(46, 60)), 0, 5);
        $o = array_slice(array_shuffle(range(61, 75)), 0, 5);
        $n[2] = 0;
        $board_array = [...$b, ...$i, ...$n, ...$g, ...$o];
        $stmt = $this->db->prepare("INSERT into bingocard (token, pos, bingo_number) values (:token, :pos, :bingo_number)");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        for ($i = 0; $i < 25; $i++) {
            $stmt->bindValue(':pos', $i, SQLITE3_INTEGER);
            $stmt->bindValue(':bingo_number', $board_array[$i], SQLITE3_INTEGER);
            $stmt->execute();
        }
        return true;
    }

    // ビンゴカード状態取得
    function get_bingo_card(string $token)
    {
        $board = array_fill(0, 25, null);
        $stmt = $this->db->prepare("SELECT pos, bingo_number from bingocard where token = :token");
        $stmt->bindValue(':token', $token, SQLITE3_TEXT);
        $result = $stmt->execute();
        if ($result === false) {
            return null;
        }
        while ($res = $result->fetchArray()) {
            $pos = $res[0];
            $num = $res[1];
            $board[$pos] = $num;
        }
        return $board;
    }

    // ビンゴの抽選を行う
    function bingo_choose(int $room_id, int $create_time = 0)
    {
        $hit_players = [];
        $win_players = [];
        $ready_players = [];

        // 未勝利のプレイヤーの未ヒットマスから抽選
        // 高々75個なので、order by random()の遅さは気にしないでよい
        $stmt = $this->db->prepare("SELECT bingo_number from user, bingocard where room_id = :room_id and win = 0 and user.token = bingocard.token and bingo_number > 0 order by random() limit 1");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $result = $stmt->execute();
        if ($result === false) {
            return null;
        }
        $result = $result->fetchArray();
        if ($result === false) {
            return null;
        }
        $bingo_number = $result[0];

        // 同ルームの全プレイヤーに対して処理
        // ヒットしたプレイヤーのプレイヤーIDを列挙
        $stmt = $this->db->prepare("SELECT user.token from bingocard, user where user.token = bingocard.token and user.room_id = :room_id and bingocard.bingo_number = :bingo_number and user.win = 0");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $stmt->bindValue(':bingo_number', $bingo_number, SQLITE3_INTEGER);
        $hit_result = $stmt->execute();
        if ($hit_result === false) {
            return null;
        }
        $hit_tokens = [];
        while ($token = $hit_result->fetchArray()) {
            array_push($hit_tokens, $token[0]);
        }

        // そのプレイヤーに対してヒット処理
        $stmt = $this->db->prepare("UPDATE bingocard set bingo_number = :new_number where token in (select token from user where room_id = :room_id) and bingo_number = :bingo_number");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $stmt->bindValue(':bingo_number', $bingo_number, SQLITE3_INTEGER);
        $stmt->bindValue(':new_number', -$bingo_number, SQLITE3_INTEGER);
        $stmt->execute();

        // リーチ・上がりチェック
        //  0, 1, 2, 3, 4
        //  5, 6, 7, 8, 9
        // 10,11,12,13,14
        // 15,16,17,18,19
        // 20,21,22,23,24
        $filter_funcs = [
            // 横
            function ($k) {
                return intdiv($k, 5) == 0; // 0,1,2,3,4
            },
            function ($k) {
                return intdiv($k, 5) == 1; // 5,6,7,8,9
            },
            function ($k) {
                return intdiv($k, 5) == 2; // 10,11,12,13,14
            },
            function ($k) {
                return intdiv($k, 5) == 3; // 15,16,17,18,19
            },
            function ($k) {
                return intdiv($k, 5) == 4; // 20,21,22,23,24
            },
            // 縦
            function ($k) {
                return ($k % 5) == 0; // 0,5,10,15,20
            },
            function ($k) {
                return ($k % 5) == 1; // 1,6,11,16,21
            },
            function ($k) {
                return ($k % 5) == 2; // 2,7,12,17,22
            },
            function ($k) {
                return ($k % 5) == 3; // 3,8,13,18,23
            },
            function ($k) {
                return ($k % 5) == 4; // 4,9,14,19,24
            },
            // 斜め
            function ($k) {
                return ($k % 6) == 0; // 0,6,12,18,24
            },
            function ($k) {
                return $k != 0 && $k != 24 && ($k % 4) == 0; // 4,8,12,16,20
            }
        ];
        foreach ($hit_tokens as $token) {
            $board = array_fill(0, 25, null);
            $player_id = null;
            $win = false;
            $stmt = $this->db->prepare("SELECT pos, bingo_number, player_id, win from bingocard, user where user.token = bingocard.token and user.token = :token");
            $stmt->bindValue(':token', $token, SQLITE3_TEXT);
            $result = $stmt->execute();
            if ($result === false) {
                return null;
            }
            while ($res = $result->fetchArray()) {
                $pos = $res[0];
                $num = $res[1];
                $board[$pos] = $num;
                $player_id = $res[2];
                $win = $res[3] !== 0;
            }
            if ($win) {
                continue;
            }
            // 今回抽選された番号が絡む、縦横斜めの並びをチェックし、各列のヒット数の最大値
            $max_hit = max(array_map(function ($f) use ($board, $bingo_number) {
                $line = array_filter($board, $f, ARRAY_FILTER_USE_KEY);
                if (in_array(-$bingo_number, $line)) {
                    return array_sum(array_map(function ($i) {
                        return $i < 1;
                    }, $line));
                }
                return -1;
            }, $filter_funcs));

            if ($max_hit == 4) {
                array_push($ready_players, $player_id);
            } else if ($max_hit == 5) {
                array_push($win_players, $player_id);
                $stmt = $this->db->prepare("UPDATE user set win = 1 where token = :token");
                $stmt->bindValue(':token', $token, SQLITE3_TEXT);
                $result = $stmt->execute();
            } else {
                array_push($hit_players, $player_id);
            }
        }

        return [$bingo_number, $hit_players, $ready_players, $win_players];
    }

    // 全プレイヤーが上がったかチェック
    function is_all_players_win(int $room_id)
    {
        $stmt = $this->db->prepare("select count(*) from user where room_id = :room_id and is_gm = 0 and win = 0");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $result = $stmt->execute();
        return $result !== false && $result->fetchArray()[0] == 0;
    }

    // 部屋に参加しているGM以外の人数を取得
    function get_user_count(int $room_id)
    {
        $stmt = $this->db->prepare("select count(*) from user where room_id = :room_id and is_gm = 0");
        $stmt->bindValue(':room_id', $room_id, SQLITE3_INTEGER);
        $result = $stmt->execute();
        if ($result === false) {
            return 0;
        }
        return $result->fetchArray()[0];
    }
}

function array_shuffle(array $array)
{
    $array_len = count($array);
    for ($i = 0; $i < $array_len; $i++) {
        $swap_idx = rand(0, $array_len - 1);
        $tmp = $array[$i];
        $array[$i] = $array[$swap_idx];
        $array[$swap_idx] = $tmp;
    }
    return $array;
}
