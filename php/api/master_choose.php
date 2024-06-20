<?php
// 戻り値はJSON
header("Content-Type: application/json");

require_once("database.php");
session_start();
$db = new DataBase();
$json = file_get_contents('php://input');
$params = json_decode($json, true);
if ($params === null || !array_key_exists("token", $params) || !$db->is_user_exist($params["token"])) {
    http_response_code(400);
    print json_encode("Error");
    exit;
}
$token = $params["token"];

$retval = [];
$retval["bingo_number"] = null;
$retval["hit_players"] = [];
$retval["ready_players"] = [];
$retval["win_players"] = [];
$room_id = $db->get_user_room_id($token);
$is_gm = $db->is_user_gm($token);
if ($room_id !== null && !$db->is_room_joinable($room_id) && $is_gm) {
    $result = $db->bingo_choose($room_id);
    if ($result !== null) {
        $retval["bingo_number"] = $result[0];
        $retval["hit_players"] = $result[1];
        $retval["ready_players"] = $result[2];
        $retval["win_players"] = $result[3];
        $db->add_bingo_event($room_id, $result[0]);
        $db->add_room_message($room_id, sprintf("抽選された番号は「%d」です。", $result[0]));
        foreach ($result[1] as $hit) {
            $db->add_room_message($room_id, sprintf("プレイヤー#%dさんがヒットしました。", $hit));
        }
        foreach ($result[2] as $ready) {
            $db->add_room_message($room_id, sprintf("プレイヤー#%dさんがリーチしました。", $ready));
        }
        foreach ($result[3] as $win) {
            $db->add_room_message($room_id, sprintf("プレイヤー#%dさんが上がりました！", $win));
        }
    }
    if (!$db->is_room_finished($room_id) && $db->is_all_players_win($room_id)) {
        $db->add_room_message($room_id, "全てのプレイヤーがビンゴしたため、ゲームを終了します。");
        $db->room_finish($room_id);
        $db->add_room_message($room_id, sprintf("部屋#%dは解散されました。", $room_id));
    }
}

// クライアントに返す
echo json_encode($retval);
