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

// ユーザの生存
$user_alive = $db->heartbeat_user($token);

// ルームの生存
$room_id = $db->get_user_room_id($token);
$room_alive = $room_id !== null && $db->heartbeat_room($room_id);

echo json_encode([$user_alive, $room_alive]);
