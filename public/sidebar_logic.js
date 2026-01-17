
// Sidebar Population
function populateSidebar({ standard, trending }) {
    const sidebarList = document.getElementById('sidebar-room-list');
    if (!sidebarList) return;

    sidebarList.innerHTML = '';

    // Helper to create list item
    const createItem = (room, isTrending) => {
        const li = document.createElement('li');
        li.innerHTML = isTrending ? `<i class="fas fa-fire" style="color: #ffaa00;"></i> ${room}` : `<i class="fas fa-hashtag"></i> ${room}`;
        li.dataset.room = room;
        if (room === currentRoom) li.classList.add('active');

        li.addEventListener('click', () => {
            if (currentRoom === room) return;
            switchRoom(room);
        });

        return li;
    };

    // Standard Rooms
    standard.forEach(room => sidebarList.appendChild(createItem(room, false)));

    // Trending Rooms
    if (trending && trending.length > 0) {
        const divider = document.createElement('li');
        divider.style.borderTop = "1px solid rgba(255,255,255,0.1)";
        divider.style.margin = "10px 0";
        divider.style.pointerEvents = "none";
        sidebarList.appendChild(divider);

        trending.forEach(room => sidebarList.appendChild(createItem(room, true)));
    }
}

// Switch Room Logic
function switchRoom(newRoom) {
    // update state
    currentRoom = newRoom;

    // Update local UI
    document.getElementById('room-name').innerText = newRoom;
    document.getElementById('chat-messages').innerHTML = ''; // Clear chat
    document.getElementById('online-count').innerHTML = '<i class="fas fa-circle"></i> 0 online'; // Reset count

    // Update Sidebar Active State
    const sidebarList = document.getElementById('sidebar-room-list');
    if (sidebarList) {
        sidebarList.querySelectorAll('li').forEach(li => {
            li.classList.remove('active');
            if (li.dataset.room === newRoom) li.classList.add('active');
        });
    }

    // Re-join via Socket
    socket.emit('joinRoom', { username: currentUsername, room: newRoom });
}
