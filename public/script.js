const API_URL = 'http://localhost:3000';

let token = localStorage.getItem('token');
let selectedPin = null;
let currentEditingTaskId = null;
let editingTaskId = null;

// DOM elementlerini saklamak için
const elements = {
    loginForm: null,
    registerForm: null,
    authContainer: null,
    todoContainer: null,
    taskInput: null,
    taskList: null
};

// DOM elementlerini yükle
function initializeElements() {
    elements.loginForm = document.getElementById('login-form');
    elements.registerForm = document.getElementById('register-form');
    elements.authContainer = document.getElementById('auth-container');
    elements.todoContainer = document.getElementById('todo-container');
    elements.taskInput = document.getElementById('taskInput');
    elements.taskList = document.getElementById('taskList');

    // Elementlerin varlığını kontrol et
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Element bulunamadı: ${key}`);
        }
    }
}

async function makeRequest(url, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        // Token varsa ekle
        const token = localStorage.getItem('token');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        console.log('Making request:', { url, method, options });

        const response = await fetch(url, options);
        const responseData = await response.json();

        console.log('Response received:', responseData);

        if (!response.ok) {
            throw new Error(responseData.error || responseData.message || 'Sunucu hatası');
        }

        return responseData;
    } catch (error) {
        console.error('Request error:', error);
        throw error;
    }
}

function toggleForm(showFormId, hideFormId) {
    if (elements[showFormId] && elements[hideFormId]) {
        elements[showFormId].style.display = 'block';
        elements[hideFormId].style.display = 'none';
    }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-password-confirm').value;

    if (!username || !password) {
        alert('Kullanıcı adı ve şifre gereklidir!');
        return;
    }

    if (password !== confirmPassword) {
        alert('Şifreler eşleşmiyor!');
        return;
    }

    try {
        await makeRequest('/register', 'POST', { username, password });
        alert('Kayıt başarılı! Giriş yapabilirsiniz.');
        toggleForm('loginForm', 'registerForm');
    } catch (error) {
        alert(error.message);
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        alert('Kullanıcı adı ve şifre gereklidir!');
        return;
    }

    try {
        const data = await makeRequest('/login', 'POST', { username, password });
        token = data.token;
        localStorage.setItem('token', token);
        localStorage.setItem('username', data.username);
        
        elements.authContainer.style.display = 'none';
        elements.todoContainer.style.display = 'block';
        loadTasks();
    } catch (error) {
        alert(error.message);
    }
}

function logout() {
    token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    elements.authContainer.style.display = 'block';
    elements.todoContainer.style.display = 'none';
    elements.taskList.innerHTML = '';
}

async function loadTasks() {
    try {
        const tasks = await makeRequest('/tasks');
        elements.taskList.innerHTML = '';
        
        tasks.forEach(task => {
            const div = document.createElement('div');
            div.className = `task-item priority-${task.priority}`;
            div.setAttribute('data-task-id', task.id);
            
            // Tarih kontrolü ve formatlama
            let dueDateDisplay = task.due_date ? formatDateTime(new Date(task.due_date)) : 'Tarih yok';
            const createdDate = new Date(task.created_at).toLocaleDateString();
            
            div.innerHTML = `
                <div class="task-content">
                    <span class="${task.completed ? 'completed' : ''}" 
                          onclick="toggleTask(${task.id})">${task.text}</span>
                    <div class="task-info">
                        <div class="priority-badge ${task.priority}">
                            ${getPriorityText(task.priority)}
                        </div>
                        <div class="date-info">
                            <div class="due-date ${isOverdue(task.due_date) ? 'overdue' : ''}">
                                <i class="fas fa-clock"></i> Son: ${dueDateDisplay}
                            </div>
                            <div class="created-date">
                                Oluşturulma: ${createdDate}
                            </div>
                        </div>
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteTask(${task.id})">Sil</button>
            `;
            
            elements.taskList.appendChild(div);
        });
    } catch (error) {
        console.error('Load tasks error:', error);
        if (error.message.includes('token')) {
            logout();
        } else {
            alert(error.message);
        }
    }
}

// Tarih ve saat formatlama fonksiyonu güncelleme
function formatDateTime(date) {
    try {
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleString('tr-TR', options);
    } catch (error) {
        console.error('Date formatting error:', error);
        return 'Geçersiz tarih';
    }
}

function getPriorityText(priority) {
    const texts = {
        'low': 'Düşük',
        'medium': 'Orta',
        'high': 'Yüksek'
    };
    return texts[priority] || 'Orta';
}

function isOverdue(dueDate) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
}

async function addTask() {
    try {
        const text = elements.taskInput.value.trim();
        const dueDate = document.getElementById('dueDateInput').value;
        const dueTime = document.getElementById('dueTimeInput').value || '23:59';
        const priority = document.getElementById('priorityInput').value;

        console.log('Adding task:', { text, dueDate, dueTime, priority });

        if (!text) {
            alert('Lütfen bir görev girin');
            return;
        }

        let dueDateTime = null;
        if (dueDate) {
            dueDateTime = `${dueDate}T${dueTime}:00`;
            console.log('Formatted datetime:', dueDateTime);
        }

        const response = await makeRequest('/tasks', 'POST', {
            text,
            dueDate: dueDateTime,
            priority
        });

        console.log('Task added successfully:', response);

        // Input alanlarını temizle
        elements.taskInput.value = '';
        document.getElementById('dueDateInput').value = '';
        document.getElementById('dueTimeInput').value = '';
        document.getElementById('priorityInput').value = 'medium';

        // Görevleri yeniden yükle
        await loadTasks();

    } catch (error) {
        console.error('Error adding task:', error);
        alert(`Görev eklenirken hata oluştu: ${error.message}`);
    }
}

async function toggleTask(id) {
    try {
        await makeRequest(`/tasks/${id}`, 'PUT');
        loadTasks();
    } catch (error) {
        if (error.message.includes('token')) {
            logout();
        } else {
            alert(error.message);
        }
    }
}

async function deleteTask(id) {
    try {
        await makeRequest(`/tasks/${id}`, 'DELETE');
        loadTasks();
    } catch (error) {
        if (error.message.includes('token')) {
            logout();
        } else {
            alert(error.message);
        }
    }
}

function handlePinClick(event, taskId) {
    const pin = event.target;
    const taskElement = pin.closest('.task-item');

    if (!selectedPin) {
        // İlk pin seçimi
        selectedPin = {
            element: pin,
            taskId: taskId,
            taskElement: taskElement
        };
        pin.classList.add('selected');
    } else if (selectedPin.taskId !== taskId) {
        // İkinci pin seçimi - bağlantı oluştur
        createConnection(selectedPin.taskElement, taskElement);
        selectedPin.element.classList.remove('selected');
        selectedPin = null;
    } else {
        // Aynı pin tekrar tıklandı - seçimi temizle
        selectedPin.element.classList.remove('selected');
        selectedPin = null;
    }
}

function createConnection(fromElement, toElement) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add('connection-line');
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    updateConnectionLine(line, fromElement, toElement);
    
    // Gradient tanımlama
    const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    gradient.id = `gradient-${fromElement.dataset.taskId}-${toElement.dataset.taskId}`;
    
    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "#ff4444");
    
    const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", "#ff8888");
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    svg.appendChild(gradient);
    
    line.setAttribute("stroke", `url(#${gradient.id})`);
    svg.appendChild(line);
    document.body.appendChild(svg);
    
    // Bağlantı noktaları ekleme
    addConnectionPoints(fromElement, toElement);
    
    // Bağlı post-it'leri işaretle
    fromElement.classList.add('connected');
    toElement.classList.add('connected');
    
    const connectionId = `connection-${fromElement.dataset.taskId}-${toElement.dataset.taskId}`;
    svg.id = connectionId;
}

function addConnectionPoints(fromElement, toElement) {
    const fromPoint = document.createElement('div');
    const toPoint = document.createElement('div');
    
    fromPoint.className = 'connection-point';
    toPoint.className = 'connection-point';
    
    const fromPin = fromElement.querySelector('.pin');
    const toPin = toElement.querySelector('.pin');
    
    const fromRect = fromPin.getBoundingClientRect();
    const toRect = toPin.getBoundingClientRect();
    
    fromPoint.style.left = `${fromRect.left + fromRect.width/2 - 4}px`;
    fromPoint.style.top = `${fromRect.top + fromRect.height/2 - 4}px`;
    
    toPoint.style.left = `${toRect.left + toRect.width/2 - 4}px`;
    toPoint.style.top = `${toRect.top + toRect.height/2 - 4}px`;
    
    document.body.appendChild(fromPoint);
    document.body.appendChild(toPoint);
}

// Bağlantıları güncelleme fonksiyonunu güncelle
function updateConnectionLine(line, fromElement, toElement) {
    const fromPin = fromElement.querySelector('.pin');
    const toPin = toElement.querySelector('.pin');
    
    const fromRect = fromPin.getBoundingClientRect();
    const toRect = toPin.getBoundingClientRect();
    
    const from = {
        x: fromRect.left + fromRect.width / 2,
        y: fromRect.top + fromRect.height / 2
    };
    
    const to = {
        x: toRect.left + toRect.width / 2,
        y: toRect.top + toRect.height / 2
    };
    
    // Bezier eğrisi için kontrol noktaları
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const ctrl1 = {
        x: from.x + dx/4,
        y: from.y + dy/2
    };
    const ctrl2 = {
        x: to.x - dx/4,
        y: to.y - dy/2
    };
    
    line.setAttribute("d", `M ${from.x},${from.y} C ${ctrl1.x},${ctrl1.y} ${ctrl2.x},${ctrl2.y} ${to.x},${to.y}`);
}

// Pencere yeniden boyutlandığında bağlantıları güncelle
window.addEventListener('resize', () => {
    const connections = document.querySelectorAll('.connection-line');
    connections.forEach(svg => {
        const [fromId, toId] = svg.id.replace('connection-', '').split('-');
        const fromElement = document.querySelector(`[data-task-id="${fromId}"]`);
        const toElement = document.querySelector(`[data-task-id="${toId}"]`);
        
        if (fromElement && toElement) {
            const line = svg.querySelector('line');
            updateConnectionLine(line, fromElement, toElement);
        }
    });
});

// Sayfa yüklendiğinde çalışacak kod
document.addEventListener('DOMContentLoaded', () => {
    // DOM elementlerini yükle
    initializeElements();

    // Token kontrolü
    if (token && elements.authContainer && elements.todoContainer) {
        elements.authContainer.style.display = 'none';
        elements.todoContainer.style.display = 'block';
        loadTasks();
    }
});

function editTask(taskId) {
    editingTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
        document.getElementById('editTaskText').value = task.text;
        
        if (task.dueDate) {
            const date = new Date(task.dueDate);
            document.getElementById('editDueDate').value = date.toISOString().split('T')[0];
            document.getElementById('editDueTime').value = date.toTimeString().slice(0,5);
        }
        
        document.getElementById('editPriority').value = task.priority;
        document.getElementById('editPopup').style.display = 'flex';
    }
}

function closePopup() {
    document.getElementById('editPopup').style.display = 'none';
    editingTaskId = null;
}

async function saveEdit() {
    if (!editingTaskId) return;

    const text = document.getElementById('editTaskText').value;
    const dueDate = document.getElementById('editDueDate').value;
    const dueTime = document.getElementById('editDueTime').value;
    const priority = document.getElementById('editPriority').value;

    const dueDateTime = `${dueDate}T${dueTime}`;

    try {
        const response = await fetch(`/tasks/${editingTaskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                dueDate: dueDateTime,
                priority
            })
        });

        if (response.ok) {
            await loadTasks();
            closePopup();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Görev güncellenirken bir hata oluştu');
    }
}

// Popup dışına tıklandığında kapatma
document.getElementById('editPopup').addEventListener('click', (e) => {
    if (e.target.className === 'popup-overlay') {
        closePopup();
    }
});

function renderTasks(tasks) {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    tasks.forEach(task => {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item priority-${task.priority}`;
        
        let formattedDate = '';
        if (task.dueDate) {
            const date = new Date(task.dueDate);
            formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }

        taskElement.innerHTML = `
            <div class="task-content">${task.text}</div>
            <div class="task-info">
                <span class="task-date">${formattedDate}</span>
                <span class="priority-badge">${task.priority}</span>
            </div>
            <div class="task-buttons">
                <button class="edit-btn" onclick="editTask('${task.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" onclick="deleteTask('${task.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        taskList.appendChild(taskElement);
    });
} 