// ===== DATA STORAGE =====
let students = JSON.parse(localStorage.getItem('students')) || [];
let editingId = null;
let deleteId = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderStudents();
    updateStats();
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Chat input
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});

// ===== THEME =====
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ===== CRUD OPERATIONS =====

// CREATE/UPDATE
function saveStudent(event) {
    event.preventDefault();
    
    const rollNo = document.getElementById('rollNo').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const math = parseInt(document.getElementById('mathMarks').value);
    const science = parseInt(document.getElementById('scienceMarks').value);
    const english = parseInt(document.getElementById('englishMarks').value);
    const history = parseInt(document.getElementById('historyMarks').value);
    
    const total = math + science + english + history;
    const percentage = (total / 400) * 100;
    const gpa = calculateGPA(percentage);
    const status = percentage >= 40 ? 'Pass' : 'Fail';
    
    const student = {
        id: editingId || Date.now(),
        rollNo,
        name,
        marks: { math, science, english, history },
        total,
        percentage,
        gpa,
        status
    };
    
    if (editingId) {
        // Update existing student
        const index = students.findIndex(s => s.id === editingId);
        students[index] = student;
    } else {
        // Add new student
        students.push(student);
    }
    
    saveToLocalStorage();
    renderStudents();
    updateStats();
    closeModal();
    
    // Show success animation
    showNotification(editingId ? 'Student updated successfully!' : 'Student added successfully!');
}

// READ
function renderStudents(filteredStudents = null) {
    const tbody = document.getElementById('studentsTableBody');
    const emptyState = document.getElementById('emptyState');
    const studentsToRender = filteredStudents || students;
    
    if (studentsToRender.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.add('show');
        return;
    }
    
    emptyState.classList.remove('show');
    
    tbody.innerHTML = studentsToRender.map(student => `
        <tr>
            <td><strong>${student.rollNo}</strong></td>
            <td>${student.name}</td>
            <td>${student.marks.math}</td>
            <td>${student.marks.science}</td>
            <td>${student.marks.english}</td>
            <td>${student.marks.history}</td>
            <td><strong>${student.total}</strong></td>
            <td><strong>${student.gpa}</strong></td>
            <td>
                <span class="status-badge ${student.status === 'Pass' ? 'status-pass' : 'status-fail'}">
                    ${student.status}
                </span>
            </td>
            <td>
                <button class="btn btn-ai" onclick="generateAIFeedback(${student.id})">
                    <i class="fas fa-brain"></i> Get Insights
                </button>
            </td>
            <td>
                <div class="action-cell">
                    <button class="btn btn-edit" onclick="editStudent(${student.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-delete" onclick="openDeleteModal(${student.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// UPDATE (Edit)
function editStudent(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;
    
    editingId = id;
    
    document.getElementById('modalTitle').textContent = 'Edit Student';
    document.getElementById('rollNo').value = student.rollNo;
    document.getElementById('studentName').value = student.name;
    document.getElementById('mathMarks').value = student.marks.math;
    document.getElementById('scienceMarks').value = student.marks.science;
    document.getElementById('englishMarks').value = student.marks.english;
    document.getElementById('historyMarks').value = student.marks.history;
    
    openModal();
}

// DELETE
function openDeleteModal(id) {
    deleteId = id;
    const student = students.find(s => s.id === id);
    document.getElementById('deleteStudentName').textContent = student.name;
    document.getElementById('deleteModal').classList.add('show');
}

function confirmDelete() {
    students = students.filter(s => s.id !== deleteId);
    saveToLocalStorage();
    renderStudents();
    updateStats();
    closeDeleteModal();
    showNotification('Student deleted successfully!');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('show');
    deleteId = null;
}

// ===== MODAL FUNCTIONS =====
function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Add New Student';
    document.getElementById('studentForm').reset();
    openModal();
}

function openModal() {
    document.getElementById('studentModal').classList.add('show');
}

function closeModal() {
    document.getElementById('studentModal').classList.remove('show');
    document.getElementById('studentForm').reset();
    editingId = null;
}

// ===== SEARCH =====
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        renderStudents();
        return;
    }
    
    const filtered = students.filter(student => 
        student.name.toLowerCase().includes(searchTerm) ||
        student.rollNo.toLowerCase().includes(searchTerm)
    );
    
    renderStudents(filtered);
}

// ===== STATS =====
function updateStats() {
    const total = students.length;
    document.getElementById('totalStudents').textContent = total;
    
    if (total === 0) {
        document.getElementById('avgGPA').textContent = '0.0';
        document.getElementById('passRate').textContent = '0%';
        return;
    }
    
    const avgGPA = (students.reduce((sum, s) => sum + parseFloat(s.gpa), 0) / total).toFixed(1);
    document.getElementById('avgGPA').textContent = avgGPA;
    
    const passCount = students.filter(s => s.status === 'Pass').length;
    const passRate = Math.round((passCount / total) * 100);
    document.getElementById('passRate').textContent = passRate + '%';
}

// ===== UTILITIES =====
function calculateGPA(percentage) {
    if (percentage >= 90) return '4.0';
    if (percentage >= 80) return '3.5';
    if (percentage >= 70) return '3.0';
    if (percentage >= 60) return '2.5';
    if (percentage >= 50) return '2.0';
    if (percentage >= 40) return '1.5';
    return '0.0';
}

function saveToLocalStorage() {
    localStorage.setItem('students', JSON.stringify(students));
}

function showNotification(message) {
    // Simple notification - you can enhance this
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// ===== EXPORT TO CSV =====
function exportToCSV() {
    if (students.length === 0) {
        alert('No students to export!');
        return;
    }
    
    const headers = ['Roll No', 'Name', 'Math', 'Science', 'English', 'History', 'Total', 'GPA', 'Status'];
    const rows = students.map(s => [
        s.rollNo,
        s.name,
        s.marks.math,
        s.marks.science,
        s.marks.english,
        s.marks.history,
        s.total,
        s.gpa,
        s.status
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('CSV exported successfully!');
}

// ===== SYNC WITH BOT =====
async function syncWithBot() {
    try {
        const response = await fetch('http://localhost:3000/sync-students', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ students })
        });
        
        if (response.ok) {
            showNotification('Data synced with AI Bot! 🤖');
        } else {
            showNotification('Failed to sync with bot');
        }
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('Bot server not running. Start with: npm start');
    }
}

// ===== DEMO DATA (Optional - for testing) =====
function loadDemoData() {
    if (students.length === 0) {
        students = [
            {
                id: 1,
                rollNo: '2024001',
                name: 'Aarav Sharma',
                marks: { math: 85, science: 90, english: 78, history: 82 },
                total: 335,
                percentage: 83.75,
                gpa: '3.5',
                status: 'Pass'
            },
            {
                id: 2,
                rollNo: '2024002',
                name: 'Priya Patel',
                marks: { math: 92, science: 88, english: 95, history: 90 },
                total: 365,
                percentage: 91.25,
                gpa: '4.0',
                status: 'Pass'
            },
            {
                id: 3,
                rollNo: '2024003',
                name: 'Rohan Kumar',
                marks: { math: 65, science: 70, english: 68, history: 72 },
                total: 275,
                percentage: 68.75,
                gpa: '2.5',
                status: 'Pass'
            }
        ];
        saveToLocalStorage();
        renderStudents();
        updateStats();
    }
}

// Uncomment the line below to load demo data on first visit
// loadDemoData();

// ===== AI CHAT FUNCTIONS =====
function toggleChat() {
    const widget = document.getElementById('chatWidget');
    const toggle = document.getElementById('chatToggle');
    
    if (widget.classList.contains('show')) {
        widget.classList.remove('show');
        toggle.style.display = 'flex';
    } else {
        widget.classList.add('show');
        toggle.style.display = 'none';
    }
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    showTyping();
    
    // Get AI response
    const response = await getAIResponse(message);
    
    // Hide typing and add response
    hideTyping();
    addMessage(response, 'bot');
}

function addMessage(text, type) {
    const messages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const icon = type === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
    messageDiv.innerHTML = `${icon}<span>${text}</span>`;
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
    const messages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = '<i class="fas fa-robot"></i><span><em>AI is thinking...</em></span>';
    messages.appendChild(typingDiv);
    messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

async function getAIResponse(message) {
    // Simulate AI response for demo - in production, use actual AI API
    const responses = {
        'hello': 'Hello! How can I help you with student management today?',
        'help': 'I can help you with student data analysis, grade predictions, study recommendations, and general queries about the system.',
        'grades': 'I can analyze student grades and provide insights. Would you like me to generate a report for a specific student?',
        'add student': 'To add a student, click the "Add Student" button in the main interface.',
        'export': 'You can export student data to CSV using the "Export CSV" button.',
        'default': 'I\'m here to assist with student management. Ask me about grades, analytics, or system features!'
    };
    
    // Simple keyword matching
    const lowerMessage = message.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
        if (lowerMessage.includes(key)) {
            return response;
        }
    }
    
    // For advanced AI integration, uncomment and configure the code below
    /*
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer YOUR_OPENAI_API_KEY` // Replace with your API key
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI assistant for a student management system. Help users with student data, grades, and educational insights.'
                    },
                    {
                        role: 'user',
                        content: message
                    }
                ],
                max_tokens: 150
            })
        });
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return 'Sorry, I\'m having trouble connecting to the AI service right now. Please try again later.';
    }
    */
    
    return responses.default;
}

// ===== AI FEEDBACK =====
async function generateAIFeedback(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    // Show loading
    showNotification('Generating AI insights...');
    
    // Simulate AI feedback generation
    const feedback = await generateFeedback(student);
    
    // Show feedback in alert (in production, use a modal)
    alert(`AI Insights for ${student.name}:\n\n${feedback}`);
}

async function generateFeedback(student) {
    // Simulate AI-generated feedback based on grades
    const { marks, gpa, status } = student;
    let feedback = '';
    
    if (status === 'Pass') {
        feedback += 'Congratulations on passing! ';
        if (gpa >= 3.5) {
            feedback += 'Excellent performance across all subjects. ';
        } else {
            feedback += 'Good job, but there\'s room for improvement. ';
        }
    } else {
        feedback += 'Unfortunately, you did not pass. Focus on weak areas. ';
    }
    
    // Subject-specific advice
    const subjects = [
        { name: 'Math', score: marks.math },
        { name: 'Science', score: marks.science },
        { name: 'English', score: marks.english },
        { name: 'History', score: marks.history }
    ];
    
    const weakSubjects = subjects.filter(s => s.score < 70);
    const strongSubjects = subjects.filter(s => s.score >= 85);
    
    if (strongSubjects.length > 0) {
        feedback += `Strong in: ${strongSubjects.map(s => s.name).join(', ')}. `;
    }
    if (weakSubjects.length > 0) {
        feedback += `Needs improvement in: ${weakSubjects.map(s => s.name).join(', ')}. `;
    }
    
    feedback += 'Keep studying and seek help when needed!';
    
    // For advanced AI, use API
    /*
    const prompt = `Generate personalized feedback for a student with grades: Math ${marks.math}, Science ${marks.science}, English ${marks.english}, History ${marks.history}. GPA: ${gpa}, Status: ${status}.`;
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer YOUR_OPENAI_API_KEY`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are an educational AI assistant providing constructive feedback to students based on their grades.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 200
            })
        });
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return feedback; // Fallback to simulated
    }
    */
    
    return feedback;
}
