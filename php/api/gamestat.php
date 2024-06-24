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
$last_msg = $params["last_msg"] ?? 0;
$last_evt = $params["last_evt"] ?? 0;

$retval = [];
$retval["messages"] = [[], 0];
$retval["events"] = [[], 0];
$retval["joinable"] = false;
$retval["finished"] = false;

$room_id = $db->get_user_room_id($token);
if ($room_id !== null) {
    $retval["messages"] = $db->get_room_messages($room_id, $last_msg);
    $retval["events"] = $db->get_bingo_events($room_id, $last_evt);
    $retval["joinable"] = $db->is_room_joinable($room_id);
    $retval["finished"] = $db->is_room_finished($room_id);
    $retval["user_count"] = $db->get_user_count($room_id);
    $retval["win_user_count"] = $db->get_win_user_count($room_id);
    $retval["ready_user_count"] = $db->get_ready_user_count($room_id);
}

echo json_encode($retval);
