let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

function loadTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    tasks.forEach((task, index) => {
        const div = document.createElement('div');
        div.className = 'task-item';
        
        div.innerHTML = `
            <span class="${task.completed ? 'completed' : ''}" onclick="toggleTask(${index})">${task.text}</span>
            <button class="delete-btn" onclick="deleteTask(${index})">Sil</button>
        `;
        
        taskList.appendChild(div);
    });
    
    saveTasks();
}

function addTask() {
    const input = document.getElementById('taskInput');
    const text = input.value.trim();
    
    if (text) {
        tasks.push({
            text: text,
            completed: false
        });
        input.value = '';
        loadTasks();
    }
}

function toggleTask(index) {
    tasks[index].completed = !tasks[index].completed;
    loadTasks();
}

function deleteTask(index) {
    tasks.splice(index, 1);
    loadTasks();
}

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

document.getElementById('taskInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addTask();
    }
});

loadTasks(); 