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
$result = null;
if ($room_id !== null && $db->is_room_joinable($room_id) && $is_gm) {
    $result = $db->start_game($room_id);
    $db->add_room_message($room_id, "参加を締め切りました。ゲームを始めます。");
}

// クライアントに返す
echo json_encode($result);
