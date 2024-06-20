<?php

function array_shuffle(array $array)
{
    $array_len = count($array);
    for ($i = 0; $i < $array_len; $i++) {
        $swap_idx = rand() % $array_len;
        $tmp = $array[$i];
        $array[$i] = $array[$swap_idx];
        $array[$swap_idx] = $tmp;
    }
    return $array;
}

class Board
{
    private $board_array;
    function __construct()
    {
        $b = array_slice(array_shuffle(range(1, 15)), 0, 5);
        $i = array_slice(array_shuffle(range(16, 30)), 0, 5);
        $n = array_slice(array_shuffle(range(31, 45)), 0, 5);
        $g = array_slice(array_shuffle(range(46, 60)), 0, 5);
        $o = array_slice(array_shuffle(range(61, 75)), 0, 5);
        $n[2] = -1;
        $this->board_array = [...$b, ...$i, ...$n, ...$g, ...$o];
    }
    function toJson()
    {
        return json_encode($this->board_array);
    }
    static function fromJson(string $json)
    {
        $b = new Board();
        $b->board_array = json_decode($json);
        return $b;
    }
}
