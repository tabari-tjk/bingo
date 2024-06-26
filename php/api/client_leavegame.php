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
if ($room_id !== null && !$is_gm) {
    $player_id = $db->get_player_id($token);
    if ($player_id !== null) {
        $db->user_leave_room($token);
        $db->add_room_message($room_id, sprintf("%sさんは退出しました。", $db->get_user_name_by_pid($room_id, $player_id)));
        $retval = true;
    }
}

echo json_encode($retval);
