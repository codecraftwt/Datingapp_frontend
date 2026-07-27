import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [],         // messages list for active chat thread
  allMessages: [],      // list of all messages across all conversations
  activeChatUser: null, // user object we are currently chatting with
  typingUsers: {},      // typing status: userId -> boolean
  loading: false,
  error: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    setAllMessages: (state, action) => {
      state.allMessages = action.payload;
    },
    addMessage: (state, action) => {
      // Avoid duplicate messages
      const exists = state.messages.some(msg => msg._id === action.payload._id || (action.payload.tempId && msg.tempId === action.payload.tempId));
      if (!exists) {
        state.messages.push(action.payload);
      }
    },
    updateMessageStatus: (state, action) => {
      const { messageId, status } = action.payload;
      const index = state.messages.findIndex(msg => msg._id === messageId);
      if (index !== -1) {
        state.messages[index].status = status;
      }
    },
    editMessageInState: (state, action) => {
      const { messageId, text } = action.payload;
      const index = state.messages.findIndex(msg => msg._id === messageId);
      if (index !== -1) {
        state.messages[index].text = text;
        state.messages[index].isEdited = true;
      }
    },
    deleteMessageInState: (state, action) => {
      const messageId = action.payload;
      state.messages = state.messages.filter(msg => msg._id !== messageId);
    },
    setActiveChatUser: (state, action) => {
      state.activeChatUser = action.payload;
    },
    setTyping: (state, action) => {
      const { userId, isTyping } = action.payload;
      state.typingUsers[userId] = isTyping;
    },
    clearChat: (state) => {
      state.messages = [];
      state.activeChatUser = null;
      state.typingUsers = {};
      state.allMessages = [];
    },
  },
});

export const {
  setMessages,
  setAllMessages,
  addMessage,
  updateMessageStatus,
  editMessageInState,
  deleteMessageInState,
  setActiveChatUser,
  setTyping,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
