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

$room_id = $db->get_user_room_id($token);
$is_gm = $db->is_user_gm($token);
if ($room_id !== null && $is_gm) {
    // すでに部屋を開いているなら何もしない
} else {
    // 新たに部屋を作る
    $room_id = $db->create_new_room_id($token);
    if ($room_id !== null) {
        $db->add_room_message($room_id, sprintf("部屋#%dを作成しました。", $room_id));
        $is_gm = true;
    }
}

// クライアントに返す
echo json_encode($room_id);
