require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

// Initialize APIs
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Load student data (in production, use database)
let students = [];
try {
  students = JSON.parse(fs.readFileSync('students.json', 'utf8'));
} catch (err) {
  console.log('No students.json found, starting with empty data');
}

// Express server for data sync
const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to sync student data from frontend
app.post('/sync-students', (req, res) => {
  students = req.body.students;
  fs.writeFileSync('students.json', JSON.stringify(students, null, 2));
  res.json({ success: true });
});

// Get student data
app.get('/students', (req, res) => {
  res.json(students);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

// Telegram bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Welcome to GradeSync AI Bot! 📚\n\nAsk me about students like:\n"How is Rohan doing?"\n"What\'s the class average?"\n"Show me top performers"');
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Available commands:\n• "How is [Student Name] doing?" - Get AI analysis\n• "Class stats" - Overall statistics\n• "Top students" - Best performers\n• "Sync data" - Update from web app');
});

// Main message handler
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Skip if no text (e.g., photo, video, etc)
    if (!text) return;

    const lowerText = text.toLowerCase();

    if (lowerText.includes('how is') && lowerText.includes('doing')) {
      const studentName = extractStudentName(lowerText);
      if (studentName) {
        const analysis = await getStudentAnalysis(studentName);
        bot.sendMessage(chatId, analysis, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, 'Please specify a student name. Example: "How is Rohan doing?"');
      }
    } else if (lowerText.includes('class stats') || lowerText.includes('statistics')) {
      const stats = getClassStats();
      bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
    } else if (lowerText.includes('top students') || lowerText.includes('best performers')) {
      const topStudents = getTopStudents();
      bot.sendMessage(chatId, topStudents, { parse_mode: 'Markdown' });
    } else if (lowerText.includes('sync data')) {
      bot.sendMessage(chatId, 'Data synced! Visit the web app to update student records.');
    } else {
      // Fallback response for unrecognized input
      bot.sendMessage(chatId, 'I didn\'t understand that. Try asking:\n• "How is [Name] doing?"\n• "Class stats"\n• "Top students"\n• "/help" for more options');
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
});

// Error handler
bot.on('error', (error) => {
  console.error('Bot error:', error.code, error.message);
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

function extractStudentName(message) {
  // Simple extraction - in production, use NLP
  const words = message.split(' ');
  const doingIndex = words.indexOf('doing');
  if (doingIndex > 0) {
    return words[doingIndex - 1].charAt(0).toUpperCase() + words[doingIndex - 1].slice(1);
  }
  return null;
}

async function getStudentAnalysis(studentName) {
  const student = students.find(s => s.name.toLowerCase().includes(studentName.toLowerCase()));

  if (!student) {
    return `I couldn't find a student named ${studentName}. Please check the spelling or ensure they're in the system.`;
  }

  const prompt = `Analyze this student's performance and provide constructive feedback:

Student: ${student.name}
Roll No: ${student.rollNo}
Grades:
- Math: ${student.marks.math}/100
- Science: ${student.marks.science}/100
- English: ${student.marks.english}/100
- History: ${student.marks.history}/100
Total: ${student.total}/400
GPA: ${student.gpa}
Status: ${student.status}

Provide a brief, encouraging analysis with specific recommendations for improvement.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    return `📊 **${student.name}'s Performance Analysis**\n\n${response.content[0].text}`;
  } catch (error) {
    console.error('Claude API error:', error);
    return `Here's ${student.name}'s summary:\n\n📈 GPA: ${student.gpa}\n🎯 Status: ${student.status}\n📚 Total Score: ${student.total}/400\n\nStrong subjects: ${getStrongSubjects(student)}\nAreas for improvement: ${getWeakSubjects(student)}`;
  }
}

function getStrongSubjects(student) {
  const subjects = [];
  if (student.marks.math >= 80) subjects.push('Math');
  if (student.marks.science >= 80) subjects.push('Science');
  if (student.marks.english >= 80) subjects.push('English');
  if (student.marks.history >= 80) subjects.push('History');
  return subjects.length > 0 ? subjects.join(', ') : 'None outstanding';
}

function getWeakSubjects(student) {
  const subjects = [];
  if (student.marks.math < 70) subjects.push('Math');
  if (student.marks.science < 70) subjects.push('Science');
  if (student.marks.english < 70) subjects.push('English');
  if (student.marks.history < 70) subjects.push('History');
  return subjects.length > 0 ? subjects.join(', ') : 'All subjects are good';
}

function getClassStats() {
  if (students.length === 0) return 'No student data available.';

  const totalStudents = students.length;
  const passed = students.filter(s => s.status === 'Pass').length;
  const avgGPA = students.reduce((sum, s) => sum + parseFloat(s.gpa), 0) / totalStudents;
  const avgTotal = students.reduce((sum, s) => sum + s.total, 0) / totalStudents;

  return `📈 **Class Statistics**\n\n👥 Total Students: ${totalStudents}\n✅ Pass Rate: ${((passed/totalStudents)*100).toFixed(1)}%\n🎓 Average GPA: ${avgGPA.toFixed(2)}\n📊 Average Total: ${avgTotal.toFixed(1)}/400`;
}

function getTopStudents() {
  if (students.length === 0) return 'No student data available.';

  const topStudents = students
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((s, i) => `${i+1}. ${s.name} - ${s.total}/400 (GPA: ${s.gpa})`);

  return `🏆 **Top Performers**\n\n${topStudents.join('\n')}`;
}

console.log('GradeSync AI Bot is running... 🤖');
console.log('Bot token:', process.env.TELEGRAM_BOT_TOKEN ? '✓ Configured' : '✗ Missing');
console.log('Claude API:', process.env.CLAUDE_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Students loaded:', students.length);
console.log('Listening for messages...\n');