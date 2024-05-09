document.addEventListener('DOMContentLoaded', function() {
    // Fetch and display teams
    fetchTeams();

    // Fetch and display players for the first team initially
    const firstTeamId = document.getElementById('player-team').value;
    fetchPlayers(firstTeamId);

    // Add event listener for adding a team
    document.getElementById('add-team-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const teamName = document.getElementById('team-name').value;
        const teamSport = document.getElementById('team-sport').value;
        const teamAvgAge = document.getElementById('team-avg-age').value;
        fetch('teams.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: teamName,
                sport: teamSport,
                avg_age: teamAvgAge
            })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            fetchTeams(); // Refresh team list
        })
        .catch(error => console.error('Error:', error));
    });


    // Add event listener for adding a team
document.getElementById('add-team-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const teamName = document.getElementById('team-name').value;
    const teamSport = document.getElementById('team-sport').value;
    const teamAvgAge = document.getElementById('team-avg-age').value;
    fetch('teams.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: teamName,
            sport: teamSport,
            avg_age: teamAvgAge
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        fetchTeams(); // Refresh team list
    })
    .catch(error => console.error('Error:', error));
});

// Add event listener for updating a team
document.getElementById('update-team-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const teamId = document.getElementById('team-id-update').value;
    const updatedTeamName = document.getElementById('team-name-update').value;
    const updatedTeamSport = document.getElementById('team-sport-update').value;
    const updatedTeamAvgAge = document.getElementById('team-avg-age-update').value;
    fetch('teams.php', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            team_id: teamId,
            name: updatedTeamName,
            sport: updatedTeamSport,
            avg_age: updatedTeamAvgAge
        })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        fetchTeams(); // Refresh team list
    })
    .catch(error => console.error('Error:', error));
});



    
    // Add event listener for update form submission for players
    document.getElementById('update-player-form').addEventListener('submit', function(event) {
        event.preventDefault();
        const playerId = document.getElementById('player-id-update').value;
        const updatedPlayerSurname = document.getElementById('player-surname-update').value;
        const updatedPlayerGivenNames = document.getElementById('player-given-names-update').value;
        const updatedPlayerNationality = document.getElementById('player-nationality-update').value;
        const updatedPlayerDateOfBirth = document.getElementById('player-date-of-birth-update').value;
        fetch('players.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: playerId,
                surname: updatedPlayerSurname,
                given_names: updatedPlayerGivenNames,
                nationality: updatedPlayerNationality,
                date_of_birth: updatedPlayerDateOfBirth
            })
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            fetchPlayers(); // Refresh player list
        })
        .catch(error => console.error('Error:', error));
    });
});

// Function to fetch and populate team dropdown
function fetchTeams() {
    fetch('teams.php')
    .then(response => response.json())
    .then(teams => {
        populateTeamDropdown(teams);
        displayTeams(teams); // Display teams with buttons
    })
    .catch(error => console.error('Error:', error));
}

// Function to fetch and display players for a selected team
function fetchPlayers(teamId) {
    fetch(`players.php?team_id=${teamId}`)
    .then(response => response.json())
    .then(players => {
        displayPlayers(players);
    })
    .catch(error => console.error('Error:', error));
}

// Function to populate team dropdown
function populateTeamDropdown(teams) {
    const playerTeamDropdown = document.getElementById('player-team');
    playerTeamDropdown.innerHTML = ''; // Clear existing options
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        playerTeamDropdown.appendChild(option);
    });
}

// Function to display teams in the team list with update button
function displayTeams(teams) {
    const teamList = document.getElementById('team-list');
    teamList.innerHTML = ''; // Clear existing team list
    teams.forEach(team => {
        const listItem = document.createElement('li');
        listItem.textContent = `${team.name} (${team.sport}), Avg Age: ${team.avg_age}`;

        // Add update button
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Update';
        updateButton.addEventListener('click', function() {
            document.getElementById('team-id-update').value = team.team_id;
            document.getElementById('team-name-update').value = team.name;
            document.getElementById('team-sport-update').value = team.sport;
            document.getElementById('team-avg-age-update').value = team.avg_age;
            document.getElementById('update-team-form').style.display = 'block';
        });

        listItem.appendChild(updateButton);
        teamList.appendChild(listItem);
    });
}

// Function to display players in the player list
function displayPlayers(players) {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = ''; // Clear existing player list
    players.forEach(player => {
        const listItem = document.createElement('li');
        listItem.textContent = `${player.surname}, ${player.given_names}`;

        // Add display button
        const displayButton = document.createElement('button');
        displayButton.textContent = 'Display';
        displayButton.addEventListener('click', function() {
            alert(JSON.stringify(player));
        });

        // Add delete button
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', function() {
            deletePlayer(player.id);
        });

        // Add update button
        const updateButton = document.createElement('button');
        updateButton.textContent = 'Update';
        updateButton.addEventListener('click', function() {
            document.getElementById('player-id-update').value = player.id;
            document.getElementById('player-surname-update').value = player.surname;
            document.getElementById('player-given-names-update').value = player.given_names;
            document.getElementById('player-nationality-update').value = player.nationality;
            document.getElementById('player-date-of-birth-update').value = player.date_of_birth;
            document.getElementById('update-player-modal').style.display = 'block';
        });

        listItem.appendChild(displayButton);
        listItem.appendChild(deleteButton);
        listItem.appendChild(updateButton);
        playerList.appendChild(listItem);
    });
}

// Function to delete a team
function deleteTeam(teamId) {
    fetch('teams.php', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `team_id=${teamId}`
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        fetchTeams(); // Refresh team list
    })
    .catch(error => console.error('Error:', error));
}

// Function to delete a player
function deletePlayer(playerId) {
    fetch('players.php', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `player_id=${playerId}`
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        // Optionally, refresh player list for the selected team
        // fetchPlayers(selectedTeamId); // Update player list
    })
    .catch(error => console.error('Error:', error));
}

// Add event listener for update button clicks for teams
document.getElementById('team-list').addEventListener('click', function(event) {
    if (event.target.classList.contains('update-button')) {
        const teamId = event.target.dataset.teamId; // Retrieve team ID from data attribute
        const teamName = event.target.dataset.teamName;
        const teamSport = event.target.dataset.teamSport;
        const teamAvgAge = event.target.dataset.teamAvgAge;
        populateUpdateForm('team', teamId, teamName, teamSport, teamAvgAge);
    }
});

// Function to populate the update form with team details
function populateUpdateForm(entityType, entityId, name, sport, avgAge) {
    if (entityType === 'team') {
        document.getElementById('team-id-update').value = entityId;
        document.getElementById('team-name-update').value = name;
        document.getElementById('team-sport-update').value = sport;
        document.getElementById('team-avg-age-update').value = avgAge;
        document.getElementById('update-team-form').style.display = 'block';
    }
}

// Add event listener for update button clicks for players
document.getElementById('player-list').addEventListener('click', function(event) {
    if (event.target.classList.contains('update-button')) {
        const playerId = event.target.dataset.playerId;
        const playerSurname = event.target.dataset.playerSurname;
        const playerGivenNames = event.target.dataset.playerGivenNames;
        const playerNationality = event.target.dataset.playerNationality;
        const playerDateOfBirth = event.target.dataset.playerDateOfBirth;
        populateUpdateForm('player', playerId, playerSurname, playerGivenNames, playerNationality, playerDateOfBirth);
    }
});

