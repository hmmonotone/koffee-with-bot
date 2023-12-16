const socket = io();
const messages = document.getElementById('messages');

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function displayMessage(msg) {
  const item = document.createElement('li');
  item.innerHTML = msg; // Use innerHTML to render HTML tags
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
}

socket.on('connect', () => {
  socket.emit('request chat history');
});

socket.on('chat history', (history) => {
  const parsedHistory = history.map((message) => JSON.parse(message));
  parsedHistory.forEach((message) => {
    displayMessage(`<strong>${capitalizeFirstLetter(message.role)}</strong>: ${message.content}`);
  });
});

const form = document.getElementById('form');
const input = document.getElementById('input');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', input.value);
    displayMessage(`<strong>User</strong>: ${input.value}`); // Display user's message
    input.value = '';
  }
});

socket.on('chat message', (msg) => {
  displayMessage(`<strong>Assistant</strong>: ${msg}`); // Display bot's response
});
