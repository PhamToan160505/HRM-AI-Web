const fs = require('fs');
let file = fs.readFileSync('Frontend/src/App.jsx', 'utf8');

if (!file.includes('GroupChatPage')) {
    file = file.replace(
        import ChatWidget from './components/chat/ChatWidget';,
        import ChatWidget from './components/chat/ChatWidget';\nimport GroupChatPage from './pages/chat/GroupChatPage';
    );
}

file = file.replace(/<Route path="profile" element={<ProfilePage \/>} \/>/g, 
    '<Route path="profile" element={<ProfilePage />} />\n            <Route path="chat" element={<GroupChatPage />} />');

fs.writeFileSync('Frontend/src/App.jsx', file, 'utf8');
