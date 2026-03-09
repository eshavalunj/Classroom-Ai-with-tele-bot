require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

// Detect Render environment
const isRender = process.env.RENDER === 'true';

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: !isRender
});

// Start polling safely on Render
if (isRender) {
  bot.deleteWebHook().then(() => {
    bot.startPolling();
  });
}

// Initialize Claude API
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Load student data
let students = [];
try {
  students = JSON.parse(fs.readFileSync('students.json', 'utf8'));
} catch (err) {
  console.log('No students.json found, starting with empty data');
}

// Express server
const app = express();
app.use(cors());
app.use(express.json());

// Sync student data
app.post('/sync-students', (req, res) => {
  students = req.body.students;
  fs.writeFileSync('students.json', JSON.stringify(students, null, 2));
  res.json({ success: true });
});

// Get student data
app.get('/students', (req, res) => {
  res.json(students);
});

// Health check
app.get('/', (req, res) => {
  res.send("GradeSync AI Bot is running 🤖");
});

// Use Render port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Telegram commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `Welcome to GradeSync AI Bot 📚

Ask things like:
• "How is Rohan doing?"
• "Class stats"
• "Top students"`
  );
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
`Available commands:

• How is [Student Name] doing?
• Class stats
• Top students
• Sync data`
  );
});

// Main message handler
bot.on('message', async (msg) => {
  try {

    const chatId = msg.chat.id;
    const text = msg.text;

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

      bot.sendMessage(chatId,
`I didn't understand that.

Try:
• "How is Rohan doing?"
• "Class stats"
• "Top students"
• /help`);

    }

  } catch (error) {

    console.error('Message handler error:', error);

  }
});

// Error logging
bot.on('error', (error) => {
  console.error('Bot error:', error.code, error.message);
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

// Extract student name
function extractStudentName(message) {

  const words = message.split(' ');
  const doingIndex = words.indexOf('doing');

  if (doingIndex > 0) {
    return words[doingIndex - 1].charAt(0).toUpperCase() +
           words[doingIndex - 1].slice(1);
  }

  return null;

}

// AI student analysis
async function getStudentAnalysis(studentName) {

  const student = students.find(
    s => s.name.toLowerCase().includes(studentName.toLowerCase())
  );

  if (!student) {
    return `I couldn't find a student named ${studentName}.`;
  }

  const prompt = `Analyze this student's performance:

Student: ${student.name}
Roll No: ${student.rollNo}

Math: ${student.marks.math}
Science: ${student.marks.science}
English: ${student.marks.english}
History: ${student.marks.history}

GPA: ${student.gpa}
Status: ${student.status}

Give constructive feedback and improvement suggestions.`;


  try {

    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }]
    });

    return `📊 *${student.name}'s Analysis*\n\n${response.content[0].text}`;

  } catch (error) {

    console.error('Claude API error:', error);

    return `Summary for ${student.name}

GPA: ${student.gpa}
Total Score: ${student.total}/400
Status: ${student.status}`;

  }

}

// Strong subjects
function getStrongSubjects(student) {

  const subjects = [];

  if (student.marks.math >= 80) subjects.push('Math');
  if (student.marks.science >= 80) subjects.push('Science');
  if (student.marks.english >= 80) subjects.push('English');
  if (student.marks.history >= 80) subjects.push('History');

  return subjects.join(', ') || 'None';

}

// Weak subjects
function getWeakSubjects(student) {

  const subjects = [];

  if (student.marks.math < 70) subjects.push('Math');
  if (student.marks.science < 70) subjects.push('Science');
  if (student.marks.english < 70) subjects.push('English');
  if (student.marks.history < 70) subjects.push('History');

  return subjects.join(', ') || 'None';

}

// Class statistics
function getClassStats() {

  if (students.length === 0) return 'No student data available.';

  const totalStudents = students.length;
  const passed = students.filter(s => s.status === 'Pass').length;

  const avgGPA =
    students.reduce((sum, s) => sum + parseFloat(s.gpa), 0) / totalStudents;

  const avgTotal =
    students.reduce((sum, s) => sum + s.total, 0) / totalStudents;

  return `📈 *Class Statistics*

Students: ${totalStudents}
Pass Rate: ${((passed/totalStudents)*100).toFixed(1)}%
Average GPA: ${avgGPA.toFixed(2)}
Average Score: ${avgTotal.toFixed(1)}/400`;

}

// Top performers
function getTopStudents() {

  if (students.length === 0) return 'No student data available.';

  const topStudents = students
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((s, i) => `${i+1}. ${s.name} — ${s.total}/400 (GPA ${s.gpa})`);

  return `🏆 *Top Students*

${topStudents.join('\n')}`;

}

console.log('GradeSync AI Bot is running 🤖');
console.log('Bot token:', process.env.TELEGRAM_BOT_TOKEN ? '✓ Configured' : '✗ Missing');
console.log('Claude API:', process.env.CLAUDE_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Students loaded:', students.length);
console.log('Listening for messages...');