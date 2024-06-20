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
$retval = false;
if ($room_id !== null && $is_gm) {
    $db->room_finish($room_id);
    $db->add_room_message($room_id, sprintf("部屋#%dは解散されました。", $room_id));
    $db->user_leave_room($token);
    $retval = true;
}

echo json_encode($retval);
