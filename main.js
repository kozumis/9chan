import { nanoid } from 'nanoid';

// WebsimSocket is globally available as `WebsimSocket`
const room = new WebsimSocket();

const DEFAULT_BOARD = 'random';

let currentBoard = DEFAULT_BOARD;
const boardContentDiv = document.getElementById('board-content');
const newThreadForm = document.getElementById('new-thread-form');
const newThreadSection = document.getElementById('new-thread-section'); // Get the new thread section
const navLinks = document.querySelectorAll('.board-link');
const userDisplaySpan = document.getElementById('user-display'); // New: Get the user display element

// New thread form image elements
const threadImageFileInput = document.getElementById('thread-image-file');
const threadImageUrlInput = document.getElementById('thread-image-url');
const threadFileNameDisplay = document.getElementById('thread-file-name');
const disableRepliesCheckbox = document.getElementById('disable-replies'); // New: Get the disable replies checkbox

// Define moderator usernames
const MODERATORS = [
    'kozumis', // GitHub username
    'ilovemacbooks' // Websim username
];

function isModerator(username) {
    return MODERATORS.includes(username);
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const options = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    };
    return date.toLocaleString('en-GB', options).replace(',', '');
}

function createPostElement(post, isReply = false, threadId = null) {
    const postDiv = document.createElement('div');
    postDiv.classList.add(isReply ? 'reply' : 'post');

    // Determine if this post was made by the current user
    // const isMyPost = currentUser && currentUser.username === post.name; // This variable is no longer used, removed

    let displayName = post.name || 'Anonymous';
    let nameStyle = ''; // To apply inline style for moderator name

    if (isModerator(post.name)) {
        nameStyle = ' style="color: red;"';
        displayName += ' <span style="color: red; font-weight: bold;">[MOD]</span>';
    }

    let postHtml = `
        <div class="post-info">
            <span class="post-name"${nameStyle}>${displayName}</span>
            <span class="post-timestamp">${formatTimestamp(post.timestamp)}</span>
            No.<span class="post-id">${post.id}</span>
        </div>
    `;

    if (post.subject && !isReply) { // Only show subject for original thread posts
        postHtml += `<div class="post-subject">${post.subject}</div>`;
    }

    if (post.image) {
        postHtml += `<img src="${post.image}" alt="Post Image" class="post-image">`;
    }

    // Basic greentext simulation and newlines
    const formattedComment = post.comment
        .split('\n')
        .map(line => line.startsWith('>') ? `<span style="color: green;">${line}</span>` : line)
        .join('<br>');

    postHtml += `<div class="post-comment">${formattedComment}</div>`;

    postDiv.innerHTML = postHtml;

    // Add delete button if current user is a moderator
    const currentUser = room.peers[room.clientId]; // Fetch current user inside function scope
    if (currentUser && isModerator(currentUser.username)) {
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.textContent = isReply ? 'Delete Reply' : 'Delete Thread';
        if (isReply) {
            deleteButton.onclick = () => handleDeleteReply(threadId, post.id);
        } else {
            deleteButton.onclick = () => handleDeleteThread(post.id);
        }
        postDiv.appendChild(deleteButton);
    }

    return postDiv;
}

// Renamed and refactored from createReplyForm to createReplySection
function createReplySection(threadId, repliesDisabled) {
    const sectionDiv = document.createElement('div');
    sectionDiv.classList.add('reply-section'); // A container for the button and form

    if (repliesDisabled) {
        sectionDiv.innerHTML = `<p class="replies-disabled-message">Replies are disabled for this thread.</p>`;
        return sectionDiv;
    }

    const toggleButton = document.createElement('button');
    toggleButton.classList.add('toggle-reply-form-button');
    toggleButton.textContent = 'Reply to this thread';
    sectionDiv.appendChild(toggleButton);

    const formContainer = document.createElement('div');
    formContainer.classList.add('reply-form-container');
    formContainer.style.display = 'none'; // Initially hidden

    const form = document.createElement('form');
    form.classList.add('reply-form');
    form.dataset.threadId = threadId;
    form.innerHTML = `
        <h3>Submit a Reply</h3>
        <label>Image Upload: <input type="file" name="image_file" accept="image/*"></label>
        <span class="file-name-display"></span>
        <label>Image URL: <input type="url" name="image_url" placeholder="Optional image URL (ignored if file uploaded)"></label><br>
        <label>Comment: <textarea name="comment" rows="3" required></textarea></label><br>
        <button type="submit">Reply</button>
    `;

    const fileInput = form.querySelector('input[name="image_file"]');
    const fileNameDisplay = form.querySelector('.file-name-display');
    fileInput.addEventListener('change', () => {
        fileNameDisplay.textContent = fileInput.files[0] ? fileInput.files[0].name : '';
    });

    form.addEventListener('submit', handleReplySubmit);
    formContainer.appendChild(form);
    sectionDiv.appendChild(formContainer);

    toggleButton.addEventListener('click', () => {
        formContainer.style.display = formContainer.style.display === 'none' ? 'block' : 'none';
        toggleButton.textContent = formContainer.style.display === 'none' ? 'Reply to this thread' : 'Hide Reply Form';
    });

    return sectionDiv;
}

function createThreadElement(thread) {
    const threadDiv = document.createElement('div');
    threadDiv.classList.add('thread');
    threadDiv.id = `thread-${thread.id}`; // Add an ID for easy re-rendering

    const originalPostElement = createPostElement(thread, false, thread.id); // Pass thread.id for mod actions
    threadDiv.appendChild(originalPostElement);

    const repliesContainer = document.createElement('div');
    repliesContainer.classList.add('replies-container');
    // Convert replies object to array and sort by timestamp for display
    const sortedReplies = Object.values(thread.replies || {}).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    sortedReplies.forEach(reply => {
        repliesContainer.appendChild(createPostElement(reply, true, thread.id)); // Pass thread.id for replies
    });
    threadDiv.appendChild(repliesContainer);

    // Add reply form/section
    threadDiv.appendChild(createReplySection(thread.id, thread.repliesDisabled));

    return threadDiv;
}

function displayBoard(boardName) {
    currentBoard = boardName;
    boardContentDiv.innerHTML = ''; // Clear existing content

    if (boardName === 'rules') {
        newThreadSection.style.display = 'none'; // Hide the new thread section for rules board
        boardContentDiv.innerHTML = `
            <div class="rules-container">
                <h2>9chan Rules</h2>
                <ol>
                    <li>All content must adhere to legal standards. Illicit material is strictly prohibited.</li>
                    <li>Do not post personal identifying information (doxing) of yourself or others.</li>
                    <li>Hate speech, discrimination, and harassment against any group or individual are not tolerated.</li>
                    <li>Spamming, flooding, and excessive off-topic posting are forbidden.</li>
                    <li>Respect other users. While debate is encouraged, personal attacks and excessive negativity are not.</li>
                    <li>Do not engage in illegal activities or promote them.</li>
                    <li>Impersonating moderators or other users is not allowed.</li>
                    <li>Content must be relevant to the board. Off-topic posts should be limited to /b/ - Random.</li>
                    <li>Moderators reserve the right to remove any content and ban any user at their discretion.</li>
                    <li>By using this site, you agree to these rules and the site's terms of service.</li>
                    <li>Posting copyrighted material without permission is prohibited.</li>
                    <li>Do not discuss illegal drugs, weapons, or other illicit goods.</li>
                    <li>Any content promoting self-harm or violence is strictly forbidden.</li>
                    <li>Offensive or shocking content (e.g., gore, extreme pornography) is not allowed.</li>
                    <li>Using multiple identities to circumvent bans or troll is prohibited.</li>
                </ol>
            </div>
        `;
    } else {
        newThreadSection.style.display = 'block'; // Show the new thread section for other boards
        const boardsData = room.roomState.boards || {};
        const threadsObject = boardsData[boardName] || {};
        // Convert threads object to array and sort by timestamp (descending for latest threads first)
        const threads = Object.values(threadsObject).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (threads.length === 0) {
            boardContentDiv.innerHTML = `<p class="loading-message">No threads found on /${boardName}/. Be the first to post!</p>`;
        } else {
            threads.forEach(thread => {
                boardContentDiv.appendChild(createThreadElement(thread));
            });
        }
    }

    // Update active nav link
    navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${boardName}`) {
            link.classList.add('active-board');
        } else {
            link.classList.remove('active-board');
        }
    });
}

async function handleNewThreadSubmit(event) {
    event.preventDefault();

    // The currentUser will always be available after room.initialize(),
    // even if it's a "Guest-XXXX" Websim account.
    const currentUser = room.peers[room.clientId];

    if (currentBoard === 'rules') {
        alert('Posting new threads is not allowed on the /rules/ board.');
        return;
    }

    const name = currentUser.username; // Use Websim or GitHub username
    const avatarUrl = currentUser.avatarUrl; // Use Websim or GitHub avatar URL
    const subject = document.getElementById('thread-subject').value.trim();
    const comment = document.getElementById('thread-comment').value.trim();
    const repliesDisabled = disableRepliesCheckbox.checked; // Get the state of the "Disable Replies" checkbox
    
    let imageUrl = '';
    const file = threadImageFileInput.files[0];

    if (file) {
        try {
            imageUrl = await websim.upload(file);
            console.log('File uploaded:', imageUrl);
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload image. Please try again.');
            return;
        }
    } else if (threadImageUrlInput.value.trim()) {
        imageUrl = threadImageUrlInput.value.trim();
    }

    if (!comment) {
        alert('Comment cannot be empty.');
        return;
    }

    const threadId = nanoid(10);
    const newThread = {
        id: threadId,
        board: currentBoard,
        subject: subject,
        name: name,
        avatarUrl: avatarUrl, // Store avatar URL with the post
        comment: comment,
        image: imageUrl, // User-provided image URL for the post content or uploaded URL
        timestamp: new Date().toISOString(),
        replies: {}, // Replies are stored as an object
        repliesDisabled: repliesDisabled // Store the preference
    };

    const currentBoardsState = room.roomState.boards || {};
    const currentBoardThreads = currentBoardsState[currentBoard] || {};

    // Update room state with the new thread, which automatically syncs with all clients
    // and is saved persistently by WebsimSocket.
    await room.updateRoomState({
        boards: {
            ...currentBoardsState,
            [currentBoard]: {
                ...currentBoardThreads,
                [threadId]: newThread // Add new thread directly
            }
        }
    });

    event.target.reset(); // Clear form
    threadFileNameDisplay.textContent = ''; // Clear file name display
    disableRepliesCheckbox.checked = false; // Reset the checkbox after submission
}

async function handleReplySubmit(event) {
    event.preventDefault();

    const form = event.target;
    const threadId = form.dataset.threadId;

    // The currentUser will always be available after room.initialize(),
    // even if it's a "Guest-XXXX" Websim account.
    const currentUser = room.peers[room.clientId];

    const name = currentUser.username; // Use Websim or GitHub username
    const avatarUrl = currentUser.avatarUrl; // Use Websim or GitHub avatar URL
    const comment = form.elements.comment.value.trim();
    
    let imageUrl = '';
    const fileInput = form.querySelector('input[name="image_file"]');
    const urlInput = form.querySelector('input[name="image_url"]');
    const file = fileInput.files[0];

    if (file) {
        try {
            imageUrl = await websim.upload(file);
            console.log('File uploaded for reply:', imageUrl);
        } catch (error) {
            console.error('Error uploading file for reply:', error);
            alert('Failed to upload image. Please try again.');
            return;
        }
    } else if (urlInput.value.trim()) {
        imageUrl = urlInput.value.trim();
    }

    if (!comment) {
        alert('Comment cannot be empty.');
        return;
    }

    const replyId = nanoid(10);
    const newReply = {
        id: replyId,
        name: name,
        avatarUrl: avatarUrl, // Store avatar URL with the reply
        comment: comment,
        image: imageUrl, // User-provided image URL or uploaded URL
        timestamp: new Date().toISOString()
    };

    const currentBoardsState = room.roomState.boards || {};
    const currentBoardThreads = currentBoardsState[currentBoard] || {};
    const currentThread = currentBoardThreads[threadId];

    if (currentThread) {
        // Update room state with the new reply, which automatically syncs and saves
        await room.updateRoomState({
            boards: {
                ...currentBoardsState,
                [currentBoard]: {
                    ...currentBoardThreads,
                    [threadId]: {
                        ...currentThread,
                        replies: {
                            ...currentThread.replies,
                            [replyId]: newReply // Add new reply to the replies object
                        }
                    }
                }
            }
        });
    } else {
        console.error('Thread not found for reply:', threadId);
    }
    form.reset(); // Clear reply form
    const fileNameDisplay = form.querySelector('.file-name-display'); // Get the correct file name display for this form
    if (fileNameDisplay) {
        fileNameDisplay.textContent = ''; // Clear file name display for reply form
    }
}

async function handleDeleteThread(threadId) {
    if (!confirm('Are you sure you want to delete this thread and all its replies?')) {
        return;
    }

    const currentBoardsState = room.roomState.boards || {};
    const currentBoardThreads = currentBoardsState[currentBoard] || {};

    if (currentBoardThreads[threadId]) {
        // Create a new object for the current board's threads, excluding the one to be deleted
        const updatedBoardThreads = { ...currentBoardThreads };
        delete updatedBoardThreads[threadId];

        // Update room state, which automatically syncs and saves
        await room.updateRoomState({
            boards: {
                ...currentBoardsState,
                [currentBoard]: updatedBoardThreads
            }
        });
        console.log(`Thread ${threadId} deleted from board ${currentBoard}.`);
    } else {
        console.warn(`Attempted to delete non-existent thread ${threadId}.`);
    }
}

async function handleDeleteReply(threadId, replyId) {
    if (!confirm('Are you sure you want to delete this reply?')) {
        return;
    }

    const currentBoardsState = room.roomState.boards || {};
    const currentBoardThreads = currentBoardsState[currentBoard] || {};
    const currentThread = currentBoardThreads[threadId];

    if (currentThread && currentThread.replies && currentThread.replies[replyId]) {
        // Create a new object for replies, excluding the one to be deleted
        const updatedReplies = { ...currentThread.replies };
        delete updatedReplies[replyId];

        // Update room state with proper board/thread nesting
        await room.updateRoomState({
            boards: {
                ...currentBoardsState,
                [currentBoard]: {
                    ...currentBoardThreads,
                    [threadId]: {
                        ...currentThread,
                        replies: updatedReplies
                    }
                }
            }
        });
        console.log(`Reply ${replyId} deleted from thread ${threadId}.`);
    } else {
        console.warn(`Attempted to delete non-existent reply ${replyId} in thread ${threadId}.`);
    }
}

// Test runner to verify basic thread operations
async function runTests() {
    console.log('Starting tests...');
    const results = [];
    const testBoard = 'test';

    // 1. Switch to a test board
    window.location.hash = testBoard;
    displayBoard(testBoard);
    if (newThreadSection.style.display === 'block') {
        results.push('Test 1 passed: New thread section visible on test board');
    } else {
        results.push('Test 1 failed: New thread section not visible');
    }

    // 2. Create a test thread
    const testThreadId = nanoid(10);
    const currentUser = room.peers[room.clientId];
    const newThread = {
        id: testThreadId,
        board: testBoard,
        subject: 'Automated Test',
        name: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        comment: 'This thread was created by runTests()',
        image: '',
        timestamp: new Date().toISOString(),
        replies: {},
        repliesDisabled: false
    };
    await room.updateRoomState({
        boards: {
            ...room.roomState.boards,
            [testBoard]: {
                [testThreadId]: newThread
            }
        }
    });
    // Allow UI to update
    await new Promise(r => setTimeout(r, 500));
    if (document.getElementById('thread-' + testThreadId)) {
        results.push('Test 2 passed: Thread creation reflected in UI');
    } else {
        results.push('Test 2 failed: Thread not found in UI');
    }

    // 3. Delete the test thread
    await handleDeleteThread(testThreadId);
    await new Promise(r => setTimeout(r, 500));
    if (!document.getElementById('thread-' + testThreadId)) {
        results.push('Test 3 passed: Thread deletion reflected in UI');
    } else {
        results.push('Test 3 failed: Thread still present after deletion');
    }

    // 4. Summary
    alert('Test Results:\n' + results.join('\n'));
}

function setupBoardNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const boardName = event.target.getAttribute('href').substring(1); // Remove '#'
            window.location.hash = boardName; // Update URL hash
            displayBoard(boardName);
        });
    });
}

function handleHashChange() {
    const hash = window.location.hash.substring(1);
    const boardsData = room.roomState.boards || {};
    if (hash && (boardsData[hash] || hash === 'rules')) { // Allow rules board to display even if not in room state
        displayBoard(hash);
    } else {
        window.location.hash = DEFAULT_BOARD; // Redirect to default if hash is invalid
        displayBoard(DEFAULT_BOARD);
    }
}

// Function to update the user display
function updateUserInfoDisplay() {
    const currentUser = room.peers[room.clientId];
    userDisplaySpan.innerHTML = ''; // Clear existing content

    if (currentUser && currentUser.username) {
        // Check if the username is a default "Guest-" name
        const isGuest = currentUser.username.startsWith('Guest-');

        let avatarHtml = '';
        if (currentUser.avatarUrl) {
            avatarHtml = `<img src="${currentUser.avatarUrl}" alt="Avatar" class="user-avatar"> `;
        }

        if (isGuest) {
            userDisplaySpan.innerHTML = `${avatarHtml}Welcome, <strong>Guest</strong>! `;
            const githubConnectButton = document.createElement('button');
            githubConnectButton.textContent = 'Connect with GitHub';
            githubConnectButton.className = 'connect-github-button';
            githubConnectButton.addEventListener('click', async () => {
                try {
                    await room.connectGithub();
                    console.log('Successfully connected with GitHub!');
                    updateUserInfoDisplay();
                } catch (error) {
                    console.error('GitHub connection failed:', error);
                    alert('Failed to connect with GitHub. Please try again.');
                }
            });
            userDisplaySpan.appendChild(githubConnectButton);
        } else {
            // User has a proper GitHub username
            userDisplaySpan.innerHTML = `${avatarHtml}Welcome, <strong>${currentUser.username}</strong>!`;
            if (isModerator(currentUser.username)) {
                userDisplaySpan.innerHTML += ` <span style="color: red; font-weight: bold;">[MOD]</span>`;
            }
        }
    }
}

// Listen for file selection on the new thread form to display file name
threadImageFileInput.addEventListener('change', () => {
    threadFileNameDisplay.textContent = threadImageFileInput.files[0] ? threadImageFileInput.files[0].name : '';
});

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await room.initialize();
    console.log("WebsimSocket initialized.");
    
    // ===========================
    // BEGIN LEGACY DATA MIGRATION
    // ===========================
    const rs = room.roomState;
    // 1. Migrate old `threads` field into new `boards` structure under DEFAULT_BOARD
    if (rs.threads !== undefined) {
        const legacy = rs.threads;
        let newThreads = {};
        if (Array.isArray(legacy)) {
            legacy.forEach(t => { if (t.id) newThreads[t.id] = t; });
        } else {
            newThreads = { ...legacy };
        }
        const currentBoards = rs.boards || {};
        await room.updateRoomState({
            boards: {
                ...currentBoards,
                [DEFAULT_BOARD]: newThreads
            },
            threads: null
        });
    }
    // 2. Migrate any reply arrays to objects keyed by reply.id
    if (rs.boards) {
        let needMigration = false;
        const migratedBoards = {};
        for (const boardName in rs.boards) {
            const threads = rs.boards[boardName] || {};
            const updatedThreads = {};
            for (const tid in threads) {
                const thread = { ...threads[tid] };
                if (Array.isArray(thread.replies)) {
                    const obj = {};
                    thread.replies.forEach(r => { if (r.id) obj[r.id] = r; });
                    thread.replies = obj;
                    needMigration = true;
                }
                updatedThreads[tid] = thread;
            }
            migratedBoards[boardName] = updatedThreads;
        }
        if (needMigration) {
            await room.updateRoomState({ boards: migratedBoards });
        }
    }
    // =========================
    // END LEGACY DATA MIGRATION
    // =========================

    // Ensure boards state is initialized so all clients sync on first load
    if (room.roomState.boards === undefined) {
        await room.updateRoomState({ boards: {} });
    }

    // Set up user info display & presence
    updateUserInfoDisplay();
    room.subscribePresence(() => updateUserInfoDisplay());
 
    // Listen for room state changes: just re-render threads on any update
    room.subscribeRoomState(() => {
        displayBoard(currentBoard);
    });
 
    setupBoardNavigation();
    newThreadForm.addEventListener('submit', handleNewThreadSubmit);

    // Hook up test button to run the automated tests
    const testButton = document.getElementById('run-tests');
    if (testButton) testButton.addEventListener('click', runTests);
    
    // Initial render
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
});