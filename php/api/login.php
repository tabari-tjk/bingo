<?php
// 戻り値はJSON
header("Content-Type: application/json");

require_once("database.php");
session_start();
$db = new DataBase();
$json = file_get_contents('php://input');
$params = json_decode($json, true);
if ($params === null) {
    http_response_code(400);
    print json_encode("Error");
    exit;
}
$db->clean_rooms_and_users();

$token = null;
$gm = false;
$room_id = null;
if (array_key_exists("token", $params) && $db->is_user_exist($params["token"])) {
    $token = $params["token"];
    $gm = $db->is_user_gm($token);
    // セッションに紐づいた部屋IDがあったが、既に存在しない部屋だった場合、紐づけを削除
    $room_id = $db->get_user_room_id($token);
    if ($room_id !== null && !$db->is_room_exist($room_id)) {
        $db->user_leave_room($token);
        $gm = false;
        $room_id = null;
    }
} else {
    // トークンが存在しない、または無効なユーザは新規作成
    $token = bin2hex(random_bytes(64));
    if (!$db->create_new_user($token)) {
        $token = null;
    }
}

$retval = [];
$retval["token"] = $token;
$retval["room_id"] = $room_id;
$retval["gm"] = $gm;
echo json_encode($retval);
