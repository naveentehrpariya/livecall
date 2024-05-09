<?php
require_once('config.php');

// Retrieve all teams
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $conn->prepare("SELECT * FROM teams ORDER BY name");
    $stmt->execute();
    $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($teams);
}

// Add a new team
elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $name = $data['name'];
    $sport = $data['sport'];
    $avg_age = $data['avg_age'];

    $stmt = $conn->prepare("INSERT INTO teams (name, sport, avg_age) VALUES (:name, :sport, :avg_age)");
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':sport', $sport);
    $stmt->bindParam(':avg_age', $avg_age);
    if ($stmt->execute()) {
        echo json_encode(array("message" => "Team added successfully"));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Unable to add team"));
    }
}

elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    parse_str(file_get_contents("php://input"), $data);
    $team_id = $data['team_id'];
    $name = $data['name'];
    $sport = $data['sport'];
    $avg_age = $data['avg_age'];

    $stmt = $conn->prepare("UPDATE teams SET name = :name, sport = :sport, avg_age = :avg_age WHERE team_id = :team_id");
    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':sport', $sport);
    $stmt->bindParam(':avg_age', $avg_age);
    $stmt->bindParam(':team_id', $team_id);

    if ($stmt->execute()) {
        echo json_encode(array("message" => "Team updated successfully"));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Unable to update team"));
    }
}




// Delete an existing team
elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    parse_str(file_get_contents("php://input"), $data);
    $team_id = $data['team_id'];

    $stmt = $conn->prepare("DELETE FROM teams WHERE id = :team_id");
    $stmt->bindParam(':team_id', $team_id);
    if ($stmt->execute()) {
        echo json_encode(array("message" => "Team deleted successfully"));
    } else {
        http_response_code(500);
        echo json_encode(array("message" => "Unable to delete team"));
    }
}
?>
