<?php
require_once('config.php');

// Retrieve all players of a specific team
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $team_id = $_GET['team_id'];
    $stmt = $conn->prepare("SELECT * FROM players WHERE team_id = :team_id");
    $stmt->bindParam(':team_id', $team_id);
    $stmt->execute();
    $players = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($players);
}

// Add a new player to a team
elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $team_id = $data['team_id'];
    $surname = $data['surname'];
    $given_names = $data['given_names'];
    $nationality = $data['nationality'];
    $date_of_birth = $data['date_of_birth'];

    $stmt = $conn->prepare("INSERT INTO players (team_id, surname, given_names, nationality, date_of_birth) VALUES (:team_id, :surname, :given_names, :nationality, :date_of_birth)");
    $stmt->bindParam(':team_id', $team_id);
    $stmt->bindParam(':surname', $surname);
    $stmt->bindParam(':given_names', $given_names);
    $stmt->bindParam(':nationality', $nationality);
    $stmt->bindParam(':date_of_birth', $date_of_birth);
    if ($stmt->execute()) {
        echo json_encode(array("message" => "Player added successfully"));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Unable to add player"));
    }
}

// Update information of an existing player
elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    parse_str(file_get_contents("php://input"), $data);
    $player_id = $data['player_id'];
    $team_id = $data['team_id'];
    $surname = $data['surname'];
    $given_names = $data['given_names'];
    $nationality = $data['nationality'];
    $date_of_birth = $data['date_of_birth'];

    $stmt = $conn->prepare("UPDATE players SET team_id = :team_id, surname = :surname, given_names = :given_names, nationality = :nationality, date_of_birth = :date_of_birth WHERE id = :player_id");
    $stmt->bindParam(':team_id', $team_id);
    $stmt->bindParam(':surname', $surname);
    $stmt->bindParam(':given_names', $given_names);
    $stmt->bindParam(':nationality', $nationality);
    $stmt->bindParam(':date_of_birth', $date_of_birth);
    $stmt->bindParam(':player_id', $player_id);
    if ($stmt->execute()) {
        echo json_encode(array("message" => "Player updated successfully"));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Unable to update player"));
    }
}

// Delete an existing player
elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    parse_str(file_get_contents("php://input"), $data);
    $player_id = $data['player_id'];
    $stmt = $conn->prepare("DELETE FROM players WHERE id = :player_id");
    $stmt->bindParam(':player_id', $player_id);
    if ($stmt->execute()) {
        echo json_encode(array("message" => "Player deleted successfully"));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Unable to delete player"));
    }
}
?>
