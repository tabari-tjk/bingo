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

if (array_key_exists("username", $params)) {
    $username = $params["username"] ?? "名無しさん";
    $username = trim($params["username"]);
    if(strlen($username) === 0) {
        $username = "名無しさん";
    }
    $db->set_user_name($token, $username);
}

echo "true";
