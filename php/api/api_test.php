<?php
require_once("database.php");
$db = new DataBase();
$room_id = $db->get_user_room_id($_GET["token"]);
$is_gm = $db->is_user_gm($_GET["token"]);
echo json_encode([$room_id, $is_gm]);
