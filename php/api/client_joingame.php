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

// POSTで受け取った部屋IDが実在していたら
$player_id = null;
$room_id = null;
$is_gm = $db->is_user_gm($token);
$board = null;
if (array_key_exists("room_id", $params) && $params["room_id"] !== null && $db->is_room_exist($params["room_id"])) {
    if (!$is_gm) {
        $room_id = $params["room_id"];
        // すでに参加済みの部屋があるならplayer_idが取得できる
        $player_id = $db->get_player_id($token);
        // player_idがnullなら未参加状態なので参加できる
        if ($player_id === null && $db->is_room_joinable($params["room_id"])) {
            $player_id = $db->join_room($token, $room_id);
            $board = $db->get_bingo_card($token);

            $db->add_room_message($room_id, sprintf("%sさんが参加しました", $db->get_user_name_by_pid($room_id, $player_id)));
        } else {
            // 参加済みの部屋IDを返す
            $room_id = $db->get_user_room_id($token);
            $board = $db->get_bingo_card($token);
        }
    }
}

$retval = [];
$retval["player_id"] = $player_id;
$retval["room_id"] = $room_id; // 参加済みの部屋があればそちらを返す
$retval["is_gm"] = $is_gm; // player_idがnullのときに、すでにGMとして参加しているので参加不能であることを示す
$retval["board"] = $board;
echo json_encode($retval);
